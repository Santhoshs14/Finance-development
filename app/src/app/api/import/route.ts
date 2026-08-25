import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB upload cap (statement CSVs are small)
const ACCEPTED_EXTENSIONS = [".csv", ".txt"];
const ACCEPTED_MIME = [
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/csv",
];

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const rl = await rateLimit({ key: `import-csv:${uid}`, limit: 20, windowSec: 600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Guard against memory exhaustion and obviously-wrong uploads. Statement
    // exports are small CSV/text files; reject anything larger or binary.
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2 MB." },
        { status: 413 }
      );
    }
    if (!isAcceptedUpload(file)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a .csv or .txt file." },
        { status: 415 }
      );
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
        category: sanitizeCell(category),
        notes: sanitizeCell(notes),
        payment_type: sanitizeCell(payment_type),
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

    const total = lines.length - 1;
    const truncated = total > imported + skipped;
    return NextResponse.json({
      message: truncated
        ? `Imported ${imported} transactions (reached the ${MAX_BATCH}-row limit; re-upload the remaining rows in a new file).`
        : `Imported ${imported} transactions`,
      imported,
      skipped,
      truncated,
      total,
    });
  } catch (error) {
    logger.error({ event: "import.csv_failed", uid }, error);
    return NextResponse.json(
      { error: "Failed to import transactions. Please check the file and try again." },
      { status: 500 }
    );
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

// Accept only small CSV/text uploads (by extension or known text MIME).
function isAcceptedUpload(file: File): boolean {
  const name = file.name?.toLowerCase() ?? "";
  const type = file.type?.toLowerCase() ?? "";
  const extOk = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  return extOk || ACCEPTED_MIME.includes(type);
}

// Sanitize a free-text CSV cell before persisting: strip quotes + control
// characters, and neutralize spreadsheet formula-injection by prefixing a
// leading "=", "+", "-" or "@" with a single quote so the value can never be
// interpreted as a formula if later re-exported to CSV/Excel.
function sanitizeCell(value: string): string {
  const cleaned = value
    .replace(/["']/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
  return /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
}

// Normalize various date formats to YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  const cleaned = dateStr.replace(/['"]/g, "").trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // DD/MM/YYYY or DD-MM-YYYY (most common for Indian bank statements)
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  // Fallback: try JS Date parsing
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return cleaned;
}
