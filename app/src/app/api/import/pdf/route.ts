/**
 * POST /api/import/pdf
 *
 * Parses a bank-statement PDF, auto-detects the bank, and returns a
 * preview list of transactions. Does NOT commit anything — the client
 * confirms via the existing POST /api/import/batch route.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { detectAndParse } from "@/server/parsers";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files supported" }, { status: 400 });
    }

    // Extract text from the PDF (pdf.js — lazy import so server bundle stays light)
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const doc = await loadingTask.promise;
    let fullText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      fullText +=
        content.items
          .map((item) => (item as { str?: string }).str ?? "")
          .filter(Boolean)
          .join(" ") + "\n";
    }

    const result = detectAndParse(fullText);

    logger.info({
      event: "import.pdf",
      uid,
      bank: result.bank,
      parsed: result.transactions.length,
      bytes: file.size,
    });

    return NextResponse.json({
      bank: result.bank,
      matched: result.matched,
      transactions: result.transactions.slice(0, 1000),
      total: result.transactions.length,
    });
  } catch (err) {
    logger.error({ event: "import.pdf.failed", uid }, err);
    const msg = err instanceof Error ? err.message : "PDF parse failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
