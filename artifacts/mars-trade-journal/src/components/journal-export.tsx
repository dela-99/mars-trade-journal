import { useState } from "react";
import { Download } from "lucide-react";
import { listTrades, listJournalNotes } from "@workspace/api-client-react";
import { getScreenshots } from "@/hooks/use-local-screenshots";
import {
  buildJournalExport,
  csvBundle,
  downloadFile,
  printableJournal,
} from "@/lib/journal-export";

export function JournalExportPanel() {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function exportJournal(format: "json" | "csv" | "pdf") {
    // Open during the click so popup blockers do not discard the PDF report.
    const report = format === "pdf" ? window.open("", "_blank") : null;
    if (format === "pdf" && !report) {
      setError("Allow popups to open the PDF report, then try again.");
      return;
    }
    if (report) {
      report.opener = null;
      report.document.body.textContent = "Preparing your complete journal…";
    }
    setBusy(format);
    setError("");
    try {
      // Always fetch the complete journal, irrespective of visible filters or cached errors.
      const [trades, notes, screenshots] = await Promise.all([
        listTrades({}),
        listJournalNotes(),
        getScreenshots(),
      ]);
      const data = await buildJournalExport(trades, notes, screenshots);
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
      if (report) {
        report.document.open();
        report.document.write(printableJournal(data));
        report.document.close();
        const print = async () => {
          await Promise.all(
            Array.from(report.document.images).map((img) => img.decode()),
          );
          report.focus();
          report.print();
        };
        report.document
          .getElementById("save-pdf")
          ?.addEventListener(
            "click",
            () =>
              void print().catch(() =>
                setError(
                  "An image could not be prepared for PDF. Use JSON or CSV to preserve the original images.",
                ),
              ),
          );
        await Promise.all(
          Array.from(report.document.images).map((img) => img.decode()),
        );
      }
    } catch {
      report?.close();
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
                    ? "PDF report"
                    : "JSON + images"}
            </button>
          ))}
        </div>
      </div>
      <details className="mt-3 text-xs text-muted-foreground"><summary className="w-fit cursor-pointer hover:text-primary">What’s included in each format?</summary><p className="mt-2 max-w-3xl leading-relaxed">
        PDF shows charts beside your notes. JSON embeds images; the CSV ZIP
        keeps image files alongside the data. Earlier screenshots are available
        only from the browser where you saved them.
      </p></details>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
