import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { zodErrorResponse } from "@/lib/api-handler";
import { prepareImportRows, computeImportDeltas } from "@/server/import/prepareRows";
import { getInvestmentCategories } from "@/server/repos/aggregates";

export const maxDuration = 60;

const batchSchema = z.object({
  transactions: z.array(z.unknown()).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const rl = await rateLimit({ key: `import-batch:${uid}`, limit: 60, windowSec: 600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    // Account ids are resolved up front so rows referencing accounts the caller
    // does not own are stored unlinked instead of as dangling cross-tenant refs.
    const [accountsSnap, profileDoc] = await Promise.all([
      adminDb.collection(`users/${uid}/accounts`).get(),
      adminDb.doc(`users/${uid}`).get(),
    ]);

    const { rows, skipped: invalid } = prepareImportRows(parsed.data.transactions, {
      ownedAccountIds: new Set(accountsSnap.docs.map((d) => d.id)),
      cycleStartDay: profileDoc.exists ? profileDoc.data()?.cycleStartDay || 25 : 25,
    });
    let skipped = invalid;

    if (rows.length === 0) {
      return NextResponse.json({ success: true, count: 0, imported: 0, skipped });
    }

    const txnCollection = adminDb.collection(`users/${uid}/transactions`);
    const refs = rows.map((r) => txnCollection.doc(r.importHash));

    // Drop rows imported on a previous run so aggregates are never double-counted.
    const existing = await adminDb.getAll(...refs);
    const fresh = rows.filter((_, i) => {
      if (existing[i].exists) {
        skipped++;
        return false;
      }
      return true;
    });

    if (fresh.length === 0) {
      return NextResponse.json({ success: true, count: 0, imported: 0, skipped });
    }

    const { aggregates, accounts } = computeImportDeltas(
      fresh,
      await getInvestmentCategories(uid)
    );
    const batch = adminDb.batch();

    for (const row of fresh) {
      batch.set(txnCollection.doc(row.importHash), {
        ...row.data,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    for (const [cycleKey, fields] of aggregates) {
      const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      for (const [field, by] of fields) update[field] = FieldValue.increment(by);
      batch.set(adminDb.doc(`users/${uid}/aggregates/${cycleKey}`), update, {
        merge: true,
      });
    }

    for (const [accountId, delta] of accounts) {
      const isCredit =
        accountsSnap.docs.find((d) => d.id === accountId)?.data()?.type === "credit";
      batch.update(adminDb.doc(`users/${uid}/accounts/${accountId}`), {
        [isCredit ? "liability" : "balance"]: FieldValue.increment(
          isCredit ? -delta : delta
        ),
      });
    }

    await batch.commit();

    const count = fresh.length;
    logger.info({ event: "import.batch", uid, count, skipped });
    return NextResponse.json({ success: true, count, imported: count, skipped });
  } catch (error) {
    logger.error({ event: "import.batch_failed", uid }, error);
    return NextResponse.json({ error: "Failed to import transactions" }, { status: 500 });
  }
}
