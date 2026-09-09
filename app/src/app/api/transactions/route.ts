import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { getFinancialCycleForDate } from "@/utils/financialMonth";
import { FieldValue } from "firebase-admin/firestore";
import {
  createTransactionSchema,
  transactionListQuerySchema,
} from "@/schemas/transaction";
import { zodErrorResponse } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import {
  applyAggregateDeltas,
  getInvestmentCategories,
} from "@/server/repos/aggregates";
import { transitionDeltas } from "@/server/aggregates/delta";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
} from "@/lib/idempotency";

/**
 * GET /api/transactions
 * Query params: cycleKey, limit, cursor, type
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const { searchParams } = new URL(req.url);
  const parsedQuery = transactionListQuerySchema.safeParse(
    Object.fromEntries([...searchParams.entries()].filter(([, v]) => v !== ""))
  );
  if (!parsedQuery.success) return zodErrorResponse(parsedQuery.error);
  const { cycleKey, limit, cursor, type } = parsedQuery.data;

  let query = adminDb
    .collection(`users/${uid}/transactions`)
    .orderBy("date", "desc")
    .orderBy("createdAt", "desc")
    .limit(limit);

  // Filter by cycle date range if cycleKey provided
  if (cycleKey) {
    const [year, month] = cycleKey.split("-").map(Number);
    // Read cycleStartDay from user profile
    const profileDoc = await adminDb.doc(`users/${uid}`).get();
    const startDay = profileDoc.exists ? (profileDoc.data()?.cycleStartDay || 25) : 25;
    const endDay = startDay - 1;
    const startMonth = month === 1 ? 12 : month - 1;
    const startYear = month === 1 ? year - 1 : year;
    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    query = query.where("date", ">=", startDate).where("date", "<=", endDate);
  }

  if (type) {
    query = query.where("type", "==", type);
  }

  if (cursor) {
    const cursorDoc = await adminDb
      .doc(`users/${uid}/transactions/${cursor}`)
      .get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();
  const transactions = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];

  return NextResponse.json({
    transactions,
    nextCursor: lastDoc?.id || null,
    hasMore: snapshot.docs.length === limit,
  });
}

/**
 * POST /api/transactions
 * Creates a transaction and atomically updates account balance + cycle aggregate.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  // A double-tap or a network retry must not create a second transaction.
  const claim = await claimIdempotencyKey(uid, req.headers.get("idempotency-key"));
  if (claim.state === "replay") {
    return NextResponse.json(claim.body, { status: claim.status });
  }
  if (claim.state === "in_flight") {
    return NextResponse.json(
      { error: "This transaction is already being saved" },
      { status: 409 }
    );
  }
  const idempotencyKey = claim.state === "claimed" ? claim.key : null;

  try {
    return await handleCreate(req, uid, idempotencyKey);
  } catch (err) {
    if (idempotencyKey) {
      await releaseIdempotencyKey(uid, idempotencyKey).catch((releaseErr) =>
        logger.warn({ event: "transactions.idempotency_release_failed", uid }, releaseErr)
      );
    }
    throw err;
  }
}

async function handleCreate(
  req: NextRequest,
  uid: string,
  idempotencyKey: string | null
) {
  const respond = async (payload: Record<string, unknown>, status: number) => {
    if (idempotencyKey && status < 400) {
      await completeIdempotencyKey(uid, idempotencyKey, status, payload);
    } else if (idempotencyKey) {
      await releaseIdempotencyKey(uid, idempotencyKey);
    }
    return NextResponse.json(payload, { status });
  };

  const body = await req.json();
  const parsedBody = createTransactionSchema.safeParse(body);
  if (!parsedBody.success) {
    if (idempotencyKey) await releaseIdempotencyKey(uid, idempotencyKey);
    return zodErrorResponse(parsedBody.error);
  }

  const {
    amount,
    type: explicitType,
    category,
    account_id,
    to_account_id,
    date,
    description,
    notes,
    payment_type,
    is_recurring,
    recurring_frequency,
    recurrence_interval,
  } = body;

  // Validation — account_id is optional (e.g. cash transactions)
  if (amount === undefined || amount === null || !category || !date) {
    return respond(
      { error: "Missing required fields: amount, category, date" },
      400
    );
  }

  const rawAmount = parseFloat(String(amount));
  if (isNaN(rawAmount) || rawAmount === 0) {
    return respond({ error: "Amount must be a non-zero number" }, 400);
  }

  // ─── Self Transfer: create paired transactions ───
  if (payment_type === "Self Transfer" && to_account_id) {
    const transferAmount = Math.abs(rawAmount);
    const profileDoc = await adminDb.doc(`users/${uid}`).get();
    const startDay = profileDoc.exists ? (profileDoc.data()?.cycleStartDay || 25) : 25;
    const cycle = getFinancialCycleForDate(date, startDay);

    const debitRef = adminDb.collection(`users/${uid}/transactions`).doc();
    const creditRef = adminDb.collection(`users/${uid}/transactions`).doc();

    await adminDb.runTransaction(async (transaction) => {
      // Read accounts
      let fromType = "bank";
      if (account_id) {
        const fromSnap = await transaction.get(adminDb.doc(`users/${uid}/accounts/${account_id}`));
        if (fromSnap.exists) fromType = fromSnap.data()?.type || "bank";
      }

      let toType = "bank";
      const toSnap = await transaction.get(adminDb.doc(`users/${uid}/accounts/${to_account_id}`));
      if (toSnap.exists) toType = toSnap.data()?.type || "bank";

      // Debit transaction (outgoing)
      transaction.set(debitRef, {
        amount: -transferAmount,
        account_id: account_id || "",
        category: "Transfer",
        date,
        notes: notes || "Self Transfer (Outgoing)",
        payment_type: "Self Transfer",
        type: "expense",
        cycleKey: cycle.cycleKey,
        linked_transfer_id: creditRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Credit transaction (incoming)
      transaction.set(creditRef, {
        amount: transferAmount,
        account_id: to_account_id,
        category: "Transfer",
        date,
        notes: notes || "Self Transfer (Incoming)",
        payment_type: "Self Transfer",
        type: "income",
        cycleKey: cycle.cycleKey,
        linked_transfer_id: debitRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Adjust source account
      if (account_id) {
        const fromRef = adminDb.doc(`users/${uid}/accounts/${account_id}`);
        if (fromType === "credit") {
          transaction.update(fromRef, { liability: FieldValue.increment(transferAmount) });
        } else {
          transaction.update(fromRef, { balance: FieldValue.increment(-transferAmount) });
        }
      }

      // Adjust destination account
      const toRef = adminDb.doc(`users/${uid}/accounts/${to_account_id}`);
      if (toType === "credit") {
        transaction.update(toRef, { liability: FieldValue.increment(-transferAmount) });
      } else {
        transaction.update(toRef, { balance: FieldValue.increment(transferAmount) });
      }

      // No aggregate updates for transfers!
    });

    return respond(
      { id: debitRef.id, creditId: creditRef.id, message: "Transfer created" },
      201
    );
  }

  // Derive type from explicit field, category name, or amount sign
  const type: string =
    explicitType ||
    (category === "Income" ? "income" : "expense");
  const numAmount = Math.abs(rawAmount);

  // Normalize recurring field (frontend sends recurrence_interval, accept both)
  const recurFrequency = recurring_frequency || recurrence_interval || null;

  // Determine the financial cycle — use user's cycleStartDay
  const profileDoc = await adminDb.doc(`users/${uid}`).get();
  const startDay = profileDoc.exists ? (profileDoc.data()?.cycleStartDay || 25) : 25;
  const cycle = getFinancialCycleForDate(date, startDay);
  const cycleKey = cycle.cycleKey;

  // Atomic transaction: create doc + update account + update aggregate
  const txnRef = adminDb.collection(`users/${uid}/transactions`).doc();
  const isCashPayment = payment_type === "Cash" || payment_type === "cash";

  // For cash payments, find the user's cash-type account
  let resolvedAccountId = account_id || "";
  if (isCashPayment) {
    const cashAccountsSnap = await adminDb
      .collection(`users/${uid}/accounts`)
      .where("type", "==", "cash")
      .limit(1)
      .get();
    resolvedAccountId = cashAccountsSnap.empty ? "" : cashAccountsSnap.docs[0].id;
  }

  const hasAccount = !!resolvedAccountId;
  const accountRef = hasAccount ? adminDb.doc(`users/${uid}/accounts/${resolvedAccountId}`) : null;
  const investmentCategories = await getInvestmentCategories(uid);
  const signedAmount = type === "expense" ? -numAmount : numAmount;

  const txnData = {
    amount: signedAmount,
    type,
    category,
    account_id: resolvedAccountId,
    date,
    description: description || "",
    notes: notes || "",
    payment_type: payment_type || "",
    is_recurring: is_recurring || false,
    recurring_frequency: recurFrequency,
    cycleKey,
  };

  await adminDb.runTransaction(async (transaction) => {
    if (accountRef) {
      const accountSnap = await transaction.get(accountRef);
      if (!accountSnap.exists) {
        throw new Error("Account not found");
      }

      const isCredit = accountSnap.data()!.type === "credit";
      if (isCredit) {
        transaction.update(accountRef, {
          liability: FieldValue.increment(type === "expense" ? numAmount : -numAmount),
        });
      } else {
        transaction.update(accountRef, {
          balance: FieldValue.increment(type === "expense" ? -numAmount : numAmount),
        });
      }
    }

    transaction.set(txnRef, {
      ...txnData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    applyAggregateDeltas(
      transaction,
      uid,
      transitionDeltas(null, txnData, investmentCategories)
    );
  });

  // Budget proximity alert (fire-and-forget, non-blocking)
  if (type === "expense") {
    checkBudgetAlert(uid, category, cycleKey, numAmount).catch((err) =>
      logger.warn({ event: "budget.alert_failed", uid, cycleKey }, err)
    );
  }

  return respond({ id: txnRef.id, message: "Transaction created" }, 201);
}

/**
 * Check if spending in a category has crossed 80% or 100% of the budget limit.
 * Creates a notification if threshold is crossed.
 */
async function checkBudgetAlert(uid: string, category: string, cycleKey: string, addedAmount: number) {
  // Get the budget for this category in this cycle
  const budgetSnap = await adminDb
    .collection(`users/${uid}/budgetSnapshots/${cycleKey}/categories`)
    .where("category", "==", category)
    .limit(1)
    .get();

  if (budgetSnap.empty) return;

  const budget = budgetSnap.docs[0].data();
  const limit = budget.monthly_limit || budget.limit;
  if (!limit || limit <= 0) return;

  // Get aggregate to find current spending for category
  const aggDoc = await adminDb.doc(`users/${uid}/aggregates/${cycleKey}`).get();
  const aggData = aggDoc.data();
  const spent = aggData?.categoryBreakdown?.[category] || 0;

  const prevSpent = spent - addedAmount;
  const pct = (spent / limit) * 100;
  const prevPct = (prevSpent / limit) * 100;

  let alertType: string | null = null;
  let message = "";

  if (pct >= 100 && prevPct < 100) {
    alertType = "budget_exceeded";
    message = `You've exceeded your ${category} budget of ₹${limit.toLocaleString()}!`;
  } else if (pct >= 80 && prevPct < 80) {
    alertType = "budget_warning";
    message = `You've used ${Math.round(pct)}% of your ${category} budget (₹${Math.round(spent).toLocaleString()} / ₹${limit.toLocaleString()}).`;
  }

  if (alertType) {
    await adminDb.collection(`users/${uid}/notifications`).add({
      type: alertType,
      title: alertType === "budget_exceeded" ? "Budget Exceeded" : "Budget Warning",
      message,
      category,
      cycleKey,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}
