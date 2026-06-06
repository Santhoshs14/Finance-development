"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { fmt } from "@/utils/format";
import toast from "react-hot-toast";

interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  type: "income" | "expense";
}

interface ParseResult {
  bank: string;
  matched: boolean;
  transactions: ParsedTransaction[];
  total: number;
}

export default function PdfImportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [committing, setCommitting] = useState(false);

  async function handleParse() {
    if (!file || !user) return;
    setUploading(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Failed");
      }
      const data: ParseResult = await res.json();
      setResult(data);
      // Select all by default
      setSelected(new Set(data.transactions.map((_, i) => i)));
      toast.success(
        data.matched
          ? `Parsed ${data.transactions.length} transactions from ${data.bank}`
          : `Generic parse found ${data.transactions.length} rows — review carefully`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse PDF";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleCommit() {
    if (!result || !user || selected.size === 0) return;
    setCommitting(true);
    try {
      const token = await user.getIdToken();
      const transactions = Array.from(selected).map((i) => result.transactions[i]!);
      const res = await fetch("/api/import/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transactions }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Commit failed" }));
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      toast.success(`Imported ${data.imported ?? selected.size} transactions`);
      router.push("/transactions");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setCommitting(false);
    }
  }

  function toggleAll() {
    if (!result) return;
    if (selected.size === result.transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(result.transactions.map((_, i) => i)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import bank statement</h1>
          <p className="text-sm text-muted-foreground">
            Upload a PDF statement from HDFC, SBI, ICICI, Axis, or Kotak — we&apos;ll auto-detect and parse it.
          </p>
        </div>
      </div>

      {!result && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>1. Select PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              htmlFor="pdf-input"
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 bg-card/40 p-10 text-center cursor-pointer hover:border-brand/40 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-sm">
                {file ? (
                  <span className="font-medium text-foreground">{file.name}</span>
                ) : (
                  <>
                    <span className="font-medium text-foreground">Click to choose</span>{" "}
                    or drag a PDF here
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground">Max 10 MB</div>
              <input
                id="pdf-input"
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </label>

            <div className="flex justify-end">
              <Button onClick={handleParse} disabled={!file || uploading} variant="gradient">
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" /> Parse PDF
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card variant="glass">
          <CardHeader className="flex items-center justify-between flex-row">
            <div>
              <CardTitle>2. Review &amp; confirm</CardTitle>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <Badge variant={result.matched ? "success" : "warning"}>
                  {result.matched ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> {result.bank}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" /> Generic format
                    </>
                  )}
                </Badge>
                <span className="text-muted-foreground">
                  {result.transactions.length} transactions parsed
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setResult(null); setFile(null); }}>
              Start over
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selected.size === result.transactions.length}
                        onChange={toggleAll}
                        aria-label="Select all transactions"
                      />
                    </th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transactions.map((t, i) => (
                    <tr
                      key={i}
                      className="border-t border-border/40 hover:bg-muted/30"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            });
                          }}
                          aria-label={`Select transaction on ${t.date}`}
                        />
                      </td>
                      <td className="p-3 font-mono text-xs">{t.date}</td>
                      <td className="p-3">{t.description}</td>
                      <td
                        className={
                          "p-3 text-right font-medium tabular-nums " +
                          (t.amount < 0 ? "text-danger" : "text-success")
                        }
                      >
                        {fmt(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selected.size} of {result.transactions.length} selected
              </p>
              <Button
                onClick={handleCommit}
                disabled={selected.size === 0 || committing}
                variant="gradient"
              >
                {committing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                  </>
                ) : (
                  <>Import {selected.size} transactions</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
