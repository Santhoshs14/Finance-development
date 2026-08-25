import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { zodErrorResponse } from "@/lib/api-handler";

const batchSchema = z.object({
  transactions: z.array(z.unknown()).min(1).max(100),
});

const batchItemSchema = z.object({
  date: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1).max(40)),
  amount: z.coerce.number().finite(),
  category: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  payment_type: z.string().max(50).optional(),
  type: z.string().max(20).optional(),
  account_id: z.string().max(128).optional().nullable(),
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

    // Resolve the caller's own account ids once so references to accounts they
    // do not own are dropped instead of stored as dangling cross-tenant refs.
    const accountsSnap = await adminDb.collection(`users/${uid}/accounts`).get();
    const ownedAccountIds = new Set(accountsSnap.docs.map((d) => d.id));

    const batch = adminDb.batch();
    const txnCollection = adminDb.collection(`users/${uid}/transactions`);
    let count = 0;
    let skipped = 0;

    for (const raw of parsed.data.transactions) {
      const item = batchItemSchema.safeParse(raw);
      if (!item.success) {
        skipped++;
        continue;
      }
      const { date, amount, category, notes, payment_type, account_id } = item.data;
      const ownedAccountId =
        account_id && ownedAccountIds.has(account_id) ? account_id : null;

      const docRef = txnCollection.doc();
      batch.set(docRef, {
        date,
        amount,
        category: category || "Other",
        notes: notes || "",
        payment_type: payment_type || "UPI",
        type: amount > 0 ? "income" : "expense",
        account_id: ownedAccountId,
        createdAt: FieldValue.serverTimestamp(),
        source: "csv_import",
      });
      count++;
    }

    await batch.commit();
    return NextResponse.json({ success: true, count, skipped });
  } catch (error) {
    logger.error({ event: "import.batch_failed", uid }, error);
    return NextResponse.json({ error: "Failed to import transactions" }, { status: 500 });
  }
}
