"use client";

import { useCallback, useState } from "react";

export function useExportReport() {
  const [exporting, setExporting] = useState(false);

  const exportPDF = useCallback(async (elementId: string, filename: string) => {
    setExporting(true);
    try {
      const element = document.getElementById(elementId);
      if (!element) throw new Error("Element not found");

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains("dark") ? "#1a1a2e" : "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${filename}.pdf`);
    } finally {
      setExporting(false);
    }
  }, []);

  const shareReport = useCallback(async (elementId: string, title: string) => {
    if (!navigator.share) {
      // Fallback: export as PDF
      await exportPDF(elementId, title);
      return;
    }

    try {
      const element = document.getElementById(elementId);
      if (!element) return;

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains("dark") ? "#1a1a2e" : "#ffffff",
      });

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );

      const file = new File([blob], `${title}.png`, { type: "image/png" });

      await navigator.share({
        title,
        files: [file],
      });
    } catch (err) {
      // User cancelled or share failed — silently ignore
      if ((err as Error).name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  }, [exportPDF]);

  return { exportPDF, shareReport, exporting };
}
