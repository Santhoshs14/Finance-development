import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, type Query } from "firebase-admin/firestore";
import type {
  CreateTransactionInput,
  TransactionDoc,
  TransactionListQuery,
  UpdateTransactionInput,
} from "@/schemas";
import { getFinancialCycleForDate } from "@/utils/financialMonth";
import { getCycleStartDay, sha256, snapToSerialized } from "./helpers";

const MAX_PAGE_SIZE = 200;

export async function listTransactions(
  uid: string,
  query: TransactionListQuery
): Promise<{
  transactions: TransactionDoc[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const limit = Math.min(query.limit, MAX_PAGE_SIZE);
  let q: Query = adminDb
    .collection(`users/${uid}/transactions`)
    .orderBy("date", "desc")
    .orderBy("createdAt", "desc");

  if (query.cycleKey) {
    const startDay = await getCycleStartDay(uid);
    const [yearStr, monthStr] = query.cycleKey.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const endDay = startDay - 1;
    const startMonth = month === 1 ? 12 : month - 1;
    const startYear = month === 1 ? year - 1 : year;
    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    q = q.where("date", ">=", startDate).where("date", "<=", endDate);
  }

  if (query.type) q = q.where("type", "==", query.type);
  if (query.category) q = q.where("category", "==", query.category);
  if (query.account_id) q = q.where("account_id", "==", query.account_id);

  if (query.cursor) {
    const cursorDoc = await adminDb
      .doc(`users/${uid}/transactions/${query.cursor}`)
      .get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }

  q = q.limit(limit);

  const snapshot = await q.get();
  const transactions = snapshot.docs.map((d) => snapToSerialized<TransactionDoc>(d));
  const lastDoc = snapshot.docs[snapshot.docs.length - 1];

  return {
    transactions,
    nextCursor: lastDoc?.id ?? null,
    hasMore: snapshot.docs.length === limit,
  };
}

export async function getTransaction(
  uid: string,
  txId: string
): Promise<TransactionDoc | null> {
  const doc = await adminDb.doc(`users/${uid}/transactions/${txId}`).get();
  if (!doc.exists) return null;
  return snapToSerialized<TransactionDoc>(doc);
}

interface CreateRegularTransactionResult {
  id: string;
}

/** Resolve cycle key from date + user's cycle start day. */
async function resolveCycleKey(uid: string, date: string): Promise<string> {
  const startDay = await getCycleStartDay(uid);
  return getFinancialCycleForDate(date, startDay).cycleKey;
}

/**
 * Create a transaction with paired self-transfer support.
 * Returns either the single id or `{ id, creditId }` for transfers.
 */
export async function createTransaction(
  uid: string,
  input: CreateTransactionInput
): Promise<
  | CreateRegularTransactionResult
  | { id: string; creditId: string; transfer: true }
> {
  const cycleKey = await resolveCycleKey(uid, input.date);
  const rawAmount = input.amount;

  // Self transfer — paired debit + credit transactions
  if (input.payment_type === "Self Transfer" && input.to_account_id) {
    const transferAmount = Math.abs(rawAmount);
    const debitRef = adminDb.collection(`users/${uid}/transactions`).doc();
    const creditRef = adminDb.collection(`users/${uid}/transactions`).doc();

    await adminDb.runTransaction(async (transaction) => {
      let fromType = "bank";
      if (input.account_id) {
        const fromSnap = await transaction.get(
          adminDb.doc(`users/${uid}/accounts/${input.account_id}`)
        );
        if (fromSnap.exists) fromType = (fromSnap.data()?.type as string) || "bank";
      }
      let toType = "bank";
      const toSnap = await transaction.get(
        adminDb.doc(`users/${uid}/accounts/${input.to_account_id}`)
      );
      if (toSnap.exists) toType = (toSnap.data()?.type as string) || "bank";

      transaction.set(debitRef, {
        amount: -transferAmount,
        account_id: input.account_id || "",
        category: "Transfer",
        date: input.date,
        notes: input.notes || "Self Transfer (Outgoing)",
        payment_type: "Self Transfer",
        type: "expense",
        cycleKey,
        linked_transfer_id: creditRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(creditRef, {
        amount: transferAmount,
        account_id: input.to_account_id,
        category: "Transfer",
        date: input.date,
        notes: input.notes || "Self Transfer (Incoming)",
        payment_type: "Self Transfer",
        type: "income",
        cycleKey,
        linked_transfer_id: debitRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (input.account_id) {
        const fromRef = adminDb.doc(`users/${uid}/accounts/${input.account_id}`);
        if (fromType === "credit") {
          transaction.update(fromRef, { liability: FieldValue.increment(transferAmount) });
        } else {
          transaction.update(fromRef, { balance: FieldValue.increment(-transferAmount) });
        }
      }
      const toRef = adminDb.doc(`users/${uid}/accounts/${input.to_account_id}`);
      if (toType === "credit") {
        transaction.update(toRef, { liability: FieldValue.increment(-transferAmount) });
      } else {
        transaction.update(toRef, { balance: FieldValue.increment(transferAmount) });
      }
    });

    return { id: debitRef.id, creditId: creditRef.id, transfer: true };
  }

  // Regular transaction (income/expense)
  const type = input.type ?? (input.category === "Income" ? "income" : "expense");
  const amount = Math.abs(rawAmount);
  const recurFrequency = input.recurring_frequency ?? input.recurrence_interval ?? null;

  const txRef = adminDb.collection(`users/${uid}/transactions`).doc();
  const aggRef = adminDb.doc(`users/${uid}/aggregates/${cycleKey}`);
  const accountRef = input.account_id
    ? adminDb.doc(`users/${uid}/accounts/${input.account_id}`)
    : null;

  await adminDb.runTransaction(async (transaction) => {
    // Determine account type for liability vs balance handling
    let accountType = "bank";
    if (accountRef) {
      const snap = await transaction.get(accountRef);
      if (snap.exists) accountType = (snap.data()?.type as string) || "bank";
    }

    transaction.set(txRef, {
      amount,
      type,
      category: input.category,
      account_id: input.account_id || "",
      date: input.date,
      description: input.description ?? null,
      notes: input.notes ?? "",
      payment_type: input.payment_type ?? null,
      is_recurring: input.is_recurring ?? false,
      recurring_frequency: recurFrequency,
      cycleKey,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (accountRef) {
      if (accountType === "credit") {
        transaction.update(accountRef, {
          liability: FieldValue.increment(type === "expense" ? amount : -amount),
        });
      } else {
        transaction.update(accountRef, {
          balance: FieldValue.increment(type === "expense" ? -amount : amount),
        });
      }
    }

    const aggUpdate: Record<string, unknown> = {
      transactionCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      cycleKey,
    };
    if (type === "expense") {
      aggUpdate.totalSpent = FieldValue.increment(amount);
      aggUpdate[`categoryBreakdown.${input.category}`] = FieldValue.increment(amount);
    } else {
      aggUpdate.totalIncome = FieldValue.increment(amount);
      aggUpdate[`categoryBreakdown.Income`] = FieldValue.increment(amount);
    }
    transaction.set(aggRef, aggUpdate, { merge: true });
  });

  return { id: txRef.id };
}

/** Idempotent insert used by importers — skips duplicates based on hash. */
export async function importTransactions(
  uid: string,
  rows: Omit<CreateTransactionInput, "to_account_id">[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += 400) {
    const batchSlice = rows.slice(i, i + 400);
    const batch = adminDb.batch();

    for (const row of batchSlice) {
      const hash = await sha256(
        `${row.date}|${row.amount}|${row.category}|${row.notes ?? ""}|${row.account_id ?? ""}`
      );

      const existing = await adminDb
        .collection(`users/${uid}/transactions`)
        .where("import_hash", "==", hash)
        .limit(1)
        .get();

      if (!existing.empty) {
        skipped++;
        continue;
      }

      const cycleKey = await resolveCycleKey(uid, row.date);
      const type = row.type ?? (row.amount >= 0 ? "income" : "expense");
      const amount = Math.abs(row.amount);
      const ref = adminDb.collection(`users/${uid}/transactions`).doc();
      batch.set(ref, {
        date: row.date,
        amount,
        type,
        category: row.category,
        account_id: row.account_id || "",
        notes: row.notes || "",
        payment_type: row.payment_type || "",
        import_hash: hash,
        cycleKey,
        createdAt: FieldValue.serverTimestamp(),
      });
      imported++;
    }
    await batch.commit();
  }

  return { imported, skipped };
}

import { recalcAccount } from "./accounts";
import { recalcAggregate } from "./aggregates";

export async function updateTransaction(
  uid: string,
  txId: string,
  patch: UpdateTransactionInput
): Promise<void> {
  const ref = adminDb.doc(`users/${uid}/transactions/${txId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const oldData = snap.data() as TransactionDoc;

  if (patch.category && !patch.type) {
    if (patch.category === "Income") patch.type = "income";
    else if (oldData.type === "income") patch.type = "expense";
  }

  await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const newData = { ...oldData, ...patch } as TransactionDoc;

  // Use atomic increments for balance and aggregate updates instead of recalcAccount
  // to perfectly preserve any initial balances a user might have
  await adminDb.runTransaction(async (transaction) => {
    // 1. Revert old amounts
    if (oldData.account_id) {
      const accRef = adminDb.doc(`users/${uid}/accounts/${oldData.account_id}`);
      const accSnap = await transaction.get(accRef);
      if (accSnap.exists) {
        const type = (accSnap.data()?.type as string) || "bank";
        const amt = Math.abs(oldData.amount ?? 0);
        if (type === "credit") {
          transaction.update(accRef, {
            liability: FieldValue.increment(oldData.type === "expense" ? -amt : amt)
          });
        } else {
          transaction.update(accRef, {
            balance: FieldValue.increment(oldData.type === "expense" ? amt : -amt)
          });
        }
      }
    }
    
    if (oldData.cycleKey) {
      const aggRef = adminDb.doc(`users/${uid}/aggregates/${oldData.cycleKey}`);
      const amt = Math.abs(oldData.amount ?? 0);
      const aggUpdate: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (oldData.type === "expense") {
        aggUpdate.totalSpent = FieldValue.increment(-amt);
        aggUpdate[`categoryBreakdown.${oldData.category}`] = FieldValue.increment(-amt);
      } else {
        aggUpdate.totalIncome = FieldValue.increment(-amt);
        aggUpdate[`categoryBreakdown.Income`] = FieldValue.increment(-amt);
      }
      transaction.set(aggRef, aggUpdate, { merge: true });
    }

    // 2. Apply new amounts
    if (newData.account_id) {
      const accRef = adminDb.doc(`users/${uid}/accounts/${newData.account_id}`);
      const accSnap = await transaction.get(accRef);
      if (accSnap.exists) {
        const type = (accSnap.data()?.type as string) || "bank";
        const amt = Math.abs(newData.amount ?? 0);
        if (type === "credit") {
          transaction.update(accRef, {
            liability: FieldValue.increment(newData.type === "expense" ? amt : -amt)
          });
        } else {
          transaction.update(accRef, {
            balance: FieldValue.increment(newData.type === "expense" ? -amt : amt)
          });
        }
      }
    }
    
    if (newData.cycleKey) {
      const aggRef = adminDb.doc(`users/${uid}/aggregates/${newData.cycleKey}`);
      const amt = Math.abs(newData.amount ?? 0);
      const aggUpdate: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (newData.type === "expense") {
        aggUpdate.totalSpent = FieldValue.increment(amt);
        aggUpdate[`categoryBreakdown.${newData.category}`] = FieldValue.increment(amt);
      } else {
        aggUpdate.totalIncome = FieldValue.increment(amt);
        aggUpdate[`categoryBreakdown.Income`] = FieldValue.increment(amt);
      }
      transaction.set(aggRef, aggUpdate, { merge: true });
    }
  });
}

export async function deleteTransaction(uid: string, txId: string): Promise<void> {
  const ref = adminDb.doc(`users/${uid}/transactions/${txId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() as TransactionDoc | undefined;

  // Atomic: revert balances + aggregate updates, then delete.
  await adminDb.runTransaction(async (transaction) => {
    if (data?.account_id) {
      const accountRef = adminDb.doc(`users/${uid}/accounts/${data.account_id}`);
      const accountSnap = await transaction.get(accountRef);
      if (accountSnap.exists) {
        const accountType = (accountSnap.data()?.type as string) || "bank";
        const amount = Math.abs(data.amount ?? 0);
        if (accountType === "credit") {
          transaction.update(accountRef, {
            liability: FieldValue.increment(data.type === "expense" ? -amount : amount),
          });
        } else {
          transaction.update(accountRef, {
            balance: FieldValue.increment(data.type === "expense" ? amount : -amount),
          });
        }
      }
    }

    if (data?.cycleKey) {
      const aggRef = adminDb.doc(`users/${uid}/aggregates/${data.cycleKey}`);
      const amount = Math.abs(data.amount ?? 0);
      const aggUpdate: Record<string, unknown> = {
        transactionCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (data.type === "expense") {
        aggUpdate.totalSpent = FieldValue.increment(-amount);
        aggUpdate[`categoryBreakdown.${data.category}`] = FieldValue.increment(-amount);
      } else {
        aggUpdate.totalIncome = FieldValue.increment(-amount);
        aggUpdate[`categoryBreakdown.Income`] = FieldValue.increment(-amount);
      }
      transaction.set(aggRef, aggUpdate, { merge: true });
    }

    transaction.delete(ref);

    // If linked transfer, delete the pair too.
    if (data?.linked_transfer_id) {
      const pairRef = adminDb.doc(
        `users/${uid}/transactions/${data.linked_transfer_id}`
      );
      const pairSnap = await transaction.get(pairRef);
      if (pairSnap.exists) {
        const pairData = pairSnap.data() as TransactionDoc | undefined;
        if (pairData?.account_id) {
          const pairAccRef = adminDb.doc(
            `users/${uid}/accounts/${pairData.account_id}`
          );
          const pairAccSnap = await transaction.get(pairAccRef);
          if (pairAccSnap.exists) {
            const accountType = (pairAccSnap.data()?.type as string) || "bank";
            const amount = Math.abs(pairData.amount ?? 0);
            if (accountType === "credit") {
              transaction.update(pairAccRef, {
                liability: FieldValue.increment(
                  pairData.type === "expense" ? -amount : amount
                ),
              });
            } else {
              transaction.update(pairAccRef, {
                balance: FieldValue.increment(
                  pairData.type === "expense" ? amount : -amount
                ),
              });
            }
          }
        }
        transaction.delete(pairRef);
      }
    }
  });
}
