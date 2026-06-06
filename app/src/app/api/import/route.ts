import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: "File must have header + data rows" }, { status: 400 });
    }

    // Parse CSV headers
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const dateIdx = headers.findIndex((h) => h === "date");
    const amountIdx = headers.findIndex((h) => h === "amount");
    const categoryIdx = headers.findIndex((h) => h === "category");
    const notesIdx = headers.findIndex((h) => h === "notes" || h === "description");
    const paymentIdx = headers.findIndex((h) => h === "payment_type" || h === "payment" || h === "payment type");

    if (dateIdx === -1 || amountIdx === -1) {
      return NextResponse.json(
        { error: "CSV must have 'date' and 'amount' columns" },
        { status: 400 }
      );
    }

    // Parse rows and batch write
    const batch = adminDb.batch();
    let imported = 0;
    let skipped = 0;
    const MAX_BATCH = 500;

    for (let i = 1; i < lines.length && imported < MAX_BATCH; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = cols[dateIdx]?.trim();
      const amount = parseFloat(cols[amountIdx]?.trim());

      if (!date || isNaN(amount)) {
        skipped++;
        continue;
      }

      const category = categoryIdx >= 0 ? cols[categoryIdx]?.trim() || "Uncategorized" : "Uncategorized";
      const notes = notesIdx >= 0 ? cols[notesIdx]?.trim() || "" : "";
      const payment_type = paymentIdx >= 0 ? cols[paymentIdx]?.trim() || "" : "";

      const ref = adminDb.collection(`users/${uid}/transactions`).doc();
      batch.set(ref, {
        date: normalizeDate(date),
        amount,
        category: category.replace(/['"]/g, ""),
        notes: notes.replace(/['"]/g, ""),
        payment_type: payment_type.replace(/['"]/g, ""),
        type: amount >= 0 ? "income" : "expense",
        account_id: "",
        imported: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      imported++;
    }

    if (imported === 0) {
      return NextResponse.json({ error: "No valid rows found" }, { status: 400 });
    }

    await batch.commit();

    return NextResponse.json({
      message: `Imported ${imported} transactions`,
      imported,
      skipped,
      total: lines.length - 1,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Normalize various date formats to YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  const cleaned = dateStr.replace(/['"]/g, "").trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  // MM/DD/YYYY
  const mdy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }

  // Fallback: try JS Date parsing
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return cleaned;
}
