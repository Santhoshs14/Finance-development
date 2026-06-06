"use client";

import { Download, Share2, Loader2 } from "lucide-react";
import { useExportReport } from "@/hooks/useExportReport";

interface ExportBarProps {
  elementId: string;
  filename: string;
  title: string;
}

export default function ExportBar({ elementId, filename, title }: ExportBarProps) {
  const { exportPDF, shareReport, exporting } = useExportReport();

  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportPDF(elementId, filename)}
        disabled={exporting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Export PDF
      </button>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <button
          onClick={() => shareReport(elementId, title)}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
      )}
    </div>
  );
}
