import { ExternalImportEditor } from "./external-import";
import {
  externalCsv,
  readExternalText,
  type ExternalCsv,
} from "@/lib/external-import";
import { useState } from "react";
import { Upload, FileCheck2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { readImportFile, type ImportData } from "@/lib/journal-import";
type Counts = {
  tradesAdded: number;
  notesAdded: number;
  tradesSkipped: number;
  notesSkipped: number;
  images: number;
  missingLinks: number;
};
async function request(
  action: "preview" | "commit",
  data: ImportData,
): Promise<Counts> {
  const response = await fetch(`/api/import/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    if (response.status === 413)
      throw new Error(
        "This backup exceeds the server upload limit. Use a smaller backup or contact the journal owner.",
      );
    const result = await response.json();
    throw new Error(
      result.error || "Import failed. Your existing journal is unchanged.",
    );
  }
  return response.json();
}
export function JournalImportPanel() {
  const client = useQueryClient();
  const [mode, setMode] = useState<"backup" | "external">("backup");
  const [external, setExternal] = useState<
    { kind: "csv"; csv: ExternalCsv } | { kind: "pdf"; text: string } | null
  >(null);
  const [preserveIdenticalTrades, setPreserveIdenticalTrades] = useState(false);
  const [data, setData] = useState<ImportData | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filename, setFilename] = useState("");
  async function select(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setData(null);
    setCounts(null);
    setFilename(file.name);
    setExternal(null);
    try {
      if (mode === "external") {
        if (file.size > 40 * 1024 * 1024)
          throw new Error("Choose a file up to 40 MB.");
        if (file.name.toLowerCase().endsWith(".csv"))
          setExternal({
            kind: "csv",
            csv: externalCsv(await readExternalText(file)),
          });
        else if (file.name.toLowerCase().endsWith(".pdf")) {
          const { externalPdfText } = await import("@/lib/journal-pdf");
          setExternal({
            kind: "pdf",
            text: await externalPdfText(
              new Uint8Array(await file.arrayBuffer()),
            ),
          });
        } else throw new Error("Choose a CSV or PDF from the external app.");
        return;
      }
      const parsed = {
        ...(await readImportFile(file)),
        preserveIdenticalTrades,
      };
      const preview = await request("preview", parsed);
      setData(parsed);
      setCounts(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this backup.");
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const result = await request("commit", data);
      setMessage(
        `Restored ${result.tradesAdded} trades and ${result.notesAdded} notes. ${result.tradesSkipped + result.notesSkipped} duplicates or previously imported records skipped.`,
      );
      setData(null);
      setCounts(null);
      await client.invalidateQueries();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Import failed. Retry safely; already imported records will be skipped.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Import journal backup"
      className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display font-bold">
            <Upload size={17} className="text-primary" />
            Pick up where you left off
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Restore a backup or bring in notes and data from another app. Check
            dates and duplicates before saving.
          </p>
        </div>
        <label className="block min-w-0 text-xs font-medium">
          Import source
          <select
            aria-label="Import source"
            className="control-input mt-1 w-full"
            disabled={busy}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as "backup" | "external");
              setData(null);
              setCounts(null);
              setExternal(null);
              setError("");
            }}
          >
            <option value="backup">M.A.R.S. backup</option>
            <option value="external">
              MetaTrader 5 / another app — CSV or PDF
            </option>
          </select>
        </label>
        <label
          className={`btn-quiet relative min-h-10 border border-border text-xs font-semibold ${busy ? "opacity-50" : ""}`}
        >
          {busy
            ? "Reading file…"
            : mode === "external"
              ? "Choose logs"
              : "Choose backup"}
          <input
            disabled={busy}
            aria-label="Choose journal backup"
            type="file"
            accept=".csv,.pdf,.json,.zip"
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            onChange={(e) => {
              void select(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {mode === "backup" && !data && !busy && (
        <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <input
            className="mt-0.5"
            type="checkbox"
            checked={preserveIdenticalTrades}
            onChange={(e) => setPreserveIdenticalTrades(e.target.checked)}
          />
          Keep separate trade executions with identical values. Leave unchecked
          to skip exact duplicate trades.
        </label>
      )}
      {external && (
        <ExternalImportEditor
          key={filename}
          source={external}
          busy={busy}
          onCancel={() => setExternal(null)}
          onPreview={async (parsed) => {
            setBusy(true);
            try {
              const preview = await request("preview", parsed);
              setData(parsed);
              setCounts(preview);
              setExternal(null);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {counts && data && (
        <div className="mt-4 rounded-lg bg-muted/50 p-4">
          <p className="flex items-center gap-2 break-all text-sm font-semibold">
            <FileCheck2 size={16} />
            {filename}
          </p>
          <p className="mt-2 text-sm">
            {counts.tradesAdded} trades · {counts.notesAdded} notes ·{" "}
            {counts.images} screenshots to restore
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.tradesSkipped + counts.notesSkipped} duplicate or previously
            imported records will be skipped. Whitespace-only differences are
            ignored; dates, values, links and images must match. Existing
            entries are kept.
          </p>
          {counts.missingLinks > 0 && (
            <p className="mt-2 text-sm text-destructive">
              {counts.missingLinks} selected links refer to trades absent from
              this backup. They will remain marked missing.
            </p>
          )}
          {data.warnings.map((warning, i) => (
            <p key={i} className="mt-2 text-sm text-destructive">
              {warning}
            </p>
          ))}
          <div
            className="mt-3 flex flex-wrap gap-2 text-xs"
            aria-label="Import dates"
          >
            {[
              ...new Set([
                ...data.trades.map((t) => t.entryAt.slice(0, 10)),
                ...data.notes.map((n) => n.date),
              ]),
            ]
              .sort()
              .map((date) => (
                <span
                  className="rounded-md bg-primary/10 px-2 py-1 text-primary"
                  key={date}
                >
                  {date}
                </span>
              ))}
          </div>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer">
              Review the first records
            </summary>
            <ul className="mt-2 space-y-1">
              {data.trades.slice(0, 5).map((t) => (
                <li key={t.id}>
                  {t.entryAt} · {t.symbol} · {t.side} · P&amp;L {t.pnl}
                </li>
              ))}
              {data.notes.slice(0, 5).map((n) => (
                <li key={`n${n.id}`}>
                  {n.date} · {n.title}
                </li>
              ))}
            </ul>
          </details>
          <div className="mt-4 flex gap-3">
            <button
              className="btn-primary text-xs"
              disabled={busy}
              onClick={() => void restore()}
            >
              {busy ? "Restoring…" : "Confirm import"}
            </button>
            <button
              disabled={busy}
              className="btn-quiet text-xs"
              onClick={() => {
                setData(null);
                setCounts(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 break-words text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-primary">
          {message}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Use the original ZIP, JSON or a new recoverable PDF for screenshots.
        Older printed PDFs support text recovery where their structure is
        recognized. Scanned PDFs need conversion to CSV first.
      </p>
    </section>
  );
}
