import { useState } from "react";
import { Download } from "lucide-react";
import { listTrades, listJournalNotes } from "@/api-client";
import { getScreenshots } from "@/hooks/use-local-screenshots";
import {
  buildJournalExport,
  csvBundle,
  downloadFile,
} from "@/lib/journal-export";

export function JournalExportPanel() {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function exportJournal(format: "json" | "csv" | "pdf") {
    setBusy(format);
    setError("");
    try {
      // Always fetch the complete journal, irrespective of visible filters or cached errors.
      const [trades, notes, screenshots] = await Promise.all([
        listTrades({}),
        listJournalNotes(),
        getScreenshots(),
      ]);
      const data = await buildJournalExport(
        trades,
        notes,
        screenshots.filter((image) =>
          trades.some((trade) => trade.id === image.tradeId),
        ),
      );
      const name = `mars-journal-${new Date().toISOString().slice(0, 10)}`;
      if (format === "json")
        downloadFile(
          JSON.stringify(data, null, 2),
          "application/json",
          `${name}.json`,
        );
      if (format === "csv")
        downloadFile(
          (await csvBundle(data)).slice().buffer,
          "application/zip",
          `${name}-csv.zip`,
        );
      if (format === "pdf") {
        const { createJournalPdf } = await import("@/lib/journal-pdf");
        downloadFile(
          (await createJournalPdf(data)).slice().buffer,
          "application/pdf",
          `${name}.pdf`,
        );
      }
    } catch {
      setError(
        "Export could not finish. Check your connection and browser storage access, then retry. No partial export was downloaded.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section
      className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-label="Export complete journal"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display font-bold">
            <Download size={17} className="text-primary" />
            Export your journal
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Export every trade, note, and available screenshot — including their
            links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["json", "csv", "pdf"] as const).map((format) => (
            <button
              key={format}
              className="btn-quiet min-h-10 border border-border text-xs font-semibold"
              disabled={Boolean(busy)}
              onClick={() => void exportJournal(format)}
              data-testid={`button-export-journal-${format}`}
            >
              {busy === format
                ? "Preparing…"
                : format === "csv"
                  ? "CSV + images (.zip)"
                  : format === "pdf"
                    ? "PDF backup"
                    : "JSON + images"}
            </button>
          ))}
        </div>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer hover:text-primary">
          What’s included in each format?
        </summary>
        <p className="mt-2 max-w-3xl leading-relaxed">
          PDF includes readable pages and an embedded backup for restoration.
          JSON embeds images; the CSV ZIP keeps image files alongside the data.
          Earlier screenshots for your current trades are included only from the
          browser where you saved them.
        </p>
      </details>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
