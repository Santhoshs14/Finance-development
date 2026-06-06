import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, DocumentReference } from "firebase-admin/firestore";

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

  const body = await req.json();

  // Only allow updating safe fields
  const allowedFields = ["description", "notes", "category", "date", "payment_type", "is_recurring", "recurring_frequency"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }
  // Accept frontend field name alias
  if (body.recurrence_interval !== undefined && !updates.recurring_frequency) {
    updates.recurring_frequency = body.recurrence_interval;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  updates["updatedAt"] = FieldValue.serverTimestamp();

  const docRef = adminDb.doc(`users/${uid}/transactions/${id}`);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // If category changed, update aggregates and handle type/amount flip
  const oldData = doc.data()!;
  if (updates.category && updates.category !== oldData.category) {
    const cycleKey = oldData.cycleKey || oldData._cycleKey;
    const absAmount = Math.abs(oldData.amount);
    const oldType = oldData.type;
    const newType = updates.category === "Income" ? "income" : "expense";
    const typeChanged = oldType !== newType;

    // If type flips (income↔expense), update amount sign and type
    if (typeChanged) {
      updates.type = newType;
      updates.amount = newType === "expense" ? -absAmount : absAmount;
    }

    if (cycleKey) {
      const aggregateRef = adminDb.doc(`users/${uid}/aggregates/${cycleKey}`);
      await adminDb.runTransaction(async (transaction) => {
        const aggUpdates: Record<string, unknown> = {};

        if (typeChanged) {
          // Moving between income and expense — adjust both totals
          if (oldType === "income") {
            aggUpdates["totalIncome"] = FieldValue.increment(-absAmount);
            aggUpdates["categoryBreakdown.Income"] = FieldValue.increment(-absAmount);
            aggUpdates["totalSpent"] = FieldValue.increment(absAmount);
            aggUpdates[`categoryBreakdown.${updates.category}`] = FieldValue.increment(absAmount);
          } else {
            aggUpdates["totalSpent"] = FieldValue.increment(-absAmount);
            aggUpdates[`categoryBreakdown.${oldData.category}`] = FieldValue.increment(-absAmount);
            aggUpdates["totalIncome"] = FieldValue.increment(absAmount);
            aggUpdates["categoryBreakdown.Income"] = FieldValue.increment(absAmount);
          }
        } else if (oldType === "expense") {
          // Same type, just category reassignment
          aggUpdates[`categoryBreakdown.${oldData.category}`] = FieldValue.increment(-absAmount);
          aggUpdates[`categoryBreakdown.${updates.category}`] = FieldValue.increment(absAmount);
        }

        if (Object.keys(aggUpdates).length > 0) {
          transaction.update(aggregateRef, aggUpdates);
        }
        transaction.update(docRef, updates);
      });
      return NextResponse.json({ message: "Transaction updated" });
    }
  }

  await docRef.update(updates);
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
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const data = doc.data()!;
  const linkedId = data.linked_transfer_id;

  await adminDb.runTransaction(async (transaction) => {
    // Helper to reverse a single transaction's effects
    const reverseAndDelete = async (txnData: Record<string, unknown>, txnRef: DocumentReference) => {
      const amt = Math.abs(txnData.amount as number);
      const txnType = txnData.type as string;
      const txnAccountId = txnData.account_id as string;
      const txnCycleKey = (txnData.cycleKey || txnData._cycleKey) as string;
      const txnCategory = txnData.category as string;
      const txnIsTransfer = txnData.payment_type === "Self Transfer" || txnCategory === "Transfer" || txnCategory === "Credit Card Payment";

      // Reverse account balance
      if (txnAccountId) {
        const accountRef = adminDb.doc(`users/${uid}/accounts/${txnAccountId}`);
        const accountSnap = await transaction.get(accountRef);
        if (accountSnap.exists) {
          const accountData = accountSnap.data()!;
          const isCredit = accountData.type === "credit";
          if (isCredit) {
            transaction.update(accountRef, {
              liability: FieldValue.increment(txnType === "expense" ? -amt : amt),
            });
          } else {
            if (txnType === "expense") {
              transaction.update(accountRef, { balance: FieldValue.increment(amt) });
            } else if (txnType === "income") {
              transaction.update(accountRef, { balance: FieldValue.increment(-amt) });
            }
          }
        }
      }

      // Reverse aggregate (skip for transfers)
      if (txnCycleKey && !txnIsTransfer) {
        const aggregateRef = adminDb.doc(`users/${uid}/aggregates/${txnCycleKey}`);
        const aggUpdate: Record<string, unknown> = {
          transactionCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (txnType === "expense") {
          aggUpdate["totalSpent"] = FieldValue.increment(-amt);
          aggUpdate[`categoryBreakdown.${txnCategory}`] = FieldValue.increment(-amt);
        } else if (txnType === "income") {
          aggUpdate["totalIncome"] = FieldValue.increment(-amt);
          aggUpdate["categoryBreakdown.Income"] = FieldValue.increment(-amt);
        }
        transaction.update(aggregateRef, aggUpdate);
      }

      transaction.delete(txnRef);
    };

    // Delete the primary transaction
    await reverseAndDelete(data, docRef);

    // If it's a paired transfer, also delete the linked transaction
    if (linkedId) {
      const linkedRef = adminDb.doc(`users/${uid}/transactions/${linkedId}`);
      const linkedSnap = await transaction.get(linkedRef);
      if (linkedSnap.exists) {
        await reverseAndDelete(linkedSnap.data()!, linkedRef);
      }
    }
  });

  return NextResponse.json({ message: "Transaction deleted" });
}
