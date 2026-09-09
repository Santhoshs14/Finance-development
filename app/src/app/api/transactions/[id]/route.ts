import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getFinancialCycleForDate } from "@/utils/financialMonth";
import {
  applyAggregateDeltas,
  getInvestmentCategories,
} from "@/server/repos/aggregates";
import { transitionDeltas, type AggregatableTxn } from "@/server/aggregates/delta";

const EDITABLE_FIELDS = [
  "description",
  "notes",
  "category",
  "date",
  "payment_type",
  "is_recurring",
  "recurring_frequency",
] as const;

/**
 * PATCH /api/transactions/[id]
 * Update a transaction (limited to non-financial fields for safety).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  // Accept frontend field name alias
  if (
    body.recurrence_interval !== undefined &&
    updates.recurring_frequency === undefined
  ) {
    updates.recurring_frequency = body.recurrence_interval;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const docRef = adminDb.doc(`users/${uid}/transactions/${id}`);
  const [doc, profileDoc, investmentCategories] = await Promise.all([
    docRef.get(),
    adminDb.doc(`users/${uid}`).get(),
    getInvestmentCategories(uid),
  ]);

  if (!doc.exists) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const before = doc.data()! as AggregatableTxn & Record<string, unknown>;
  const startDay = profileDoc.exists ? profileDoc.data()?.cycleStartDay || 25 : 25;
  const magnitude = Math.abs(Number(before.amount) || 0);

  // A category change can flip income<->expense, which also flips the stored sign.
  if (updates.category !== undefined && updates.category !== before.category) {
    const newType = updates.category === "Income" ? "income" : "expense";
    if (newType !== before.type) {
      updates.type = newType;
      updates.amount = newType === "expense" ? -magnitude : magnitude;
    }
  }

  // Moving the date can move the transaction into a different cycle; without
  // this the row shows under the new cycle while its totals stay in the old one.
  if (updates.date !== undefined && updates.date !== before.date) {
    updates.cycleKey = getFinancialCycleForDate(String(updates.date), startDay).cycleKey;
  }

  const after: AggregatableTxn = {
    amount: (updates.amount as number) ?? before.amount,
    type: (updates.type as string) ?? before.type,
    category: (updates.category as string) ?? before.category,
    payment_type: (updates.payment_type as string) ?? before.payment_type,
    cycleKey: (updates.cycleKey as string) ?? before.cycleKey,
  };

  updates.updatedAt = FieldValue.serverTimestamp();

  await adminDb.runTransaction(async (transaction) => {
    transaction.update(docRef, updates);
    applyAggregateDeltas(
      transaction,
      uid,
      transitionDeltas(before, after, investmentCategories)
    );
  });

  return NextResponse.json({ message: "Transaction updated" });
}

/**
 * DELETE /api/transactions/[id]
 * Delete a transaction and reverse account balance + aggregate changes.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;
  const { id } = await params;

  const docRef = adminDb.doc(`users/${uid}/transactions/${id}`);
  const [doc, investmentCategories] = await Promise.all([
    docRef.get(),
    getInvestmentCategories(uid),
  ]);

  if (!doc.exists) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const data = doc.data()!;
  const linkedId = data.linked_transfer_id as string | undefined;

  // Both halves of a paired transfer are removed together.
  const targets: {
    ref: FirebaseFirestore.DocumentReference;
    data: Record<string, unknown>;
  }[] = [{ ref: docRef, data }];

  if (linkedId) {
    const linkedRef = adminDb.doc(`users/${uid}/transactions/${linkedId}`);
    const linkedSnap = await linkedRef.get();
    if (linkedSnap.exists) targets.push({ ref: linkedRef, data: linkedSnap.data()! });
  }

  const accountIds = [
    ...new Set(
      targets.map((t) => t.data.account_id as string).filter((v): v is string => !!v)
    ),
  ];

  await adminDb.runTransaction(async (transaction) => {
    // Firestore requires every read in a transaction to precede every write.
    const accountRefs = accountIds.map((accountId) =>
      adminDb.doc(`users/${uid}/accounts/${accountId}`)
    );
    const accountSnaps = accountRefs.length
      ? await transaction.getAll(...accountRefs)
      : [];
    const isCredit = new Map(
      accountSnaps.map((snap) => [snap.id, snap.exists && snap.data()!.type === "credit"])
    );
    const exists = new Map(accountSnaps.map((snap) => [snap.id, snap.exists]));

    for (const target of targets) {
      const amount = Math.abs(Number(target.data.amount) || 0);
      const type = target.data.type as string;
      const accountId = target.data.account_id as string | undefined;

      if (accountId && exists.get(accountId)) {
        const accountRef = adminDb.doc(`users/${uid}/accounts/${accountId}`);
        if (isCredit.get(accountId)) {
          transaction.update(accountRef, {
            liability: FieldValue.increment(type === "expense" ? -amount : amount),
          });
        } else {
          transaction.update(accountRef, {
            balance: FieldValue.increment(type === "expense" ? amount : -amount),
          });
        }
      }

      applyAggregateDeltas(
        transaction,
        uid,
        transitionDeltas(target.data as AggregatableTxn, null, investmentCategories)
      );

      transaction.delete(target.ref);
    }
  });

  return NextResponse.json({ message: "Transaction deleted" });
}
