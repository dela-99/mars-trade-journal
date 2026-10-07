import { useState } from "react";
import {
  csvNotes,
  pdfNotes,
  externalData,
  type ExternalCsv,
  type DateOrder,
} from "@/lib/external-import";
import type { ImportData, ImportNote } from "@/lib/journal-import";
type Source = { kind: "csv"; csv: ExternalCsv } | { kind: "pdf"; text: string };
export function ExternalImportEditor({
  source,
  onPreview,
  busy,
  onCancel,
}: {
  source: Source;
  onPreview: (data: ImportData) => Promise<void>;
  busy: boolean;
  onCancel: () => void;
}) {
  const headers = source.kind === "csv" ? source.csv.headers : [];
  const guess = (pattern: RegExp) => headers.find((h) => pattern.test(h)) ?? "";
  const [dateColumn, setDateColumn] = useState(() =>
    guess(/^(date|journal date|entry date|trading date|day|time|timestamp)$/i),
  );
  const [titleColumn, setTitleColumn] = useState(() =>
    guess(/^(title|subject|name)$/i),
  );
  const [bodyColumn, setBodyColumn] = useState(() =>
    guess(/^(note|notes|body|text|content|description|message)$/i),
  );
  const [timeZone, setTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [fallbackDate, setFallbackDate] = useState("");
  const [order, setOrder] = useState<DateOrder>("iso");
  const [notes, setNotes] = useState<ImportNote[] | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  function prepare() {
    setError("");
    try {
      setNotes(
        source.kind === "csv"
          ? csvNotes(source.csv, {
              dateColumn,
              titleColumn,
              bodyColumn,
              timeZone,
              dateOrder: order,
              fallbackDate,
            })
          : pdfNotes(source.text, timeZone, order),
      );
      setPage(0);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function update(
    index: number,
    key: "date" | "title" | "body",
    value: string,
  ) {
    setNotes((current) =>
      current!.map((n, i) => (i === index ? { ...n, [key]: value } : n)),
    );
  }
  const select = (
    label: string,
    value: string,
    set: (s: string) => void,
    required = false,
  ) => (
    <label className="block min-w-0 text-xs font-medium">
      {label}
      <select
        className="control-input mt-1 w-full min-w-0"
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">{required ? "Choose column" : "None"}</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="mt-4 min-w-0 space-y-4 rounded-xl border border-border p-3 sm:p-4">
      <h3 className="text-sm font-semibold">Review notes from another app</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        MetaTrader 5 log rows and dated PDF sections become notes. Original
        dates link it to that day's trades, including older trades. Extra CSV
        fields remain in the note.
      </p>
      {!notes ? (
        <>
          {source.kind === "csv" && (
            <div className="grid gap-3 sm:grid-cols-3">
              {select("Date column", dateColumn, setDateColumn, true)}
              {select("Title column", titleColumn, setTitleColumn)}
              {select("Notes column", bodyColumn, setBodyColumn)}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-xs font-medium">
              Date order
              <select
                className="control-input mt-1 w-full"
                value={order}
                onChange={(e) => setOrder(e.target.value as DateOrder)}
              >
                <option value="iso">Year-month-day (2026-10-07)</option>
                <option value="day-first">Day/month/year (07/10/2026)</option>
                <option value="month-first">Month/day/year (10/07/2026)</option>
              </select>
            </label>
            <label className="block min-w-0 text-xs font-medium">
              Original computer timezone
              <input
                className="control-input mt-1 w-full"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                list="import-timezones"
              />
              <datalist id="import-timezones">
                {[
                  ...new Set([
                    "UTC",
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                    "America/New_York",
                    "Europe/London",
                    "Asia/Tokyo",
                  ]),
                ].map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            MT5 Journal and Experts logs use the original computer's timezone.
            Match that timezone here. Timestamps and messages are preserved; log
            rows do not create executed trades.
          </p>
          {source.kind === "csv" && (
            <label className="block text-xs">
              Date for rows with only a time (optional)
              <input
                type="date"
                className="control-input mt-1 w-full sm:max-w-xs"
                value={fallbackDate}
                onChange={(e) => setFallbackDate(e.target.value)}
              />
            </label>
          )}
          {source.kind === "pdf" && (
            <p className="text-xs text-muted-foreground">
              Date headings split the document into notes. Undated sections need
              a date or must be removed. Scanned images require OCR in the
              original app.
            </p>
          )}
          <button className="btn-primary min-h-11 text-xs" onClick={prepare}>
            Prepare notes
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {notes.length} notes · {timeZone}. Check the dates and full text;
            entries without dates cannot be imported.
          </p>
          {notes.slice(page * 5, page * 5 + 5).map((note, offset) => {
            const index = page * 5 + offset;
            return (
              <fieldset
                key={note.id}
                className="min-w-0 space-y-2 border-t border-border pt-3"
              >
                <legend className="text-xs text-muted-foreground">
                  Entry {index + 1}
                </legend>
                <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                  <label className="min-w-0 text-xs">
                    Journal date
                    <input
                      aria-label={`Date for entry ${index + 1}`}
                      className="control-input mt-1 w-full"
                      type="date"
                      value={note.date}
                      onChange={(e) => update(index, "date", e.target.value)}
                    />
                  </label>
                  <label className="min-w-0 text-xs">
                    Title
                    <input
                      className="control-input mt-1 w-full"
                      value={note.title}
                      maxLength={200}
                      onChange={(e) => update(index, "title", e.target.value)}
                    />
                  </label>
                </div>
                <label className="block text-xs">
                  Note and data
                  <textarea
                    className="control-input mt-1 min-h-28 w-full resize-y"
                    value={note.body}
                    maxLength={100000}
                    onChange={(e) => update(index, "body", e.target.value)}
                  />
                </label>
                <button
                  className="btn-quiet min-h-11 text-xs text-destructive"
                  onClick={() => {
                    setNotes(notes.filter((_, i) => i !== index));
                    setPage(0);
                  }}
                >
                  Exclude this entry
                </button>
              </fieldset>
            );
          })}
          {notes.length > 5 && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <button
                className="btn-quiet min-h-11"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page + 1} of {Math.ceil(notes.length / 5)}
              </span>
              <button
                className="btn-quiet min-h-11"
                disabled={(page + 1) * 5 >= notes.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || !notes.length}
              className="btn-primary min-h-11 text-xs"
              onClick={async () => {
                setError("");
                try {
                  await onPreview(externalData(notes, timeZone));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {busy ? "Checking duplicates…" : "Check dates & duplicates"}
            </button>
            <button
              disabled={busy}
              className="btn-quiet min-h-11 text-xs"
              onClick={() => setNotes(null)}
            >
              Change mapping
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="btn-quiet min-h-11 text-xs"
        onClick={onCancel}
      >
        Cancel external import
      </button>
    </div>
  );
}
