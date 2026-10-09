import { useState } from "react";
import { CalendarDays, FileText, ArrowUpRight } from "lucide-react";
import type { Trade, JournalNote } from "@/api-client";
import { journalDays, noteLinks } from "@/lib/journal";
export function JournalDays({
  trades,
  notes,
  onTrade,
  onNote,
}: {
  trades: Trade[];
  notes: JournalNote[];
  onTrade: (trade: Trade) => void;
  onNote: (note: JournalNote) => void;
}) {
  const [date, setDate] = useState("");
  const [zone, setZone] = useState("UTC");
  const days = journalDays(trades, notes, zone)
    .filter((day) => !date || day.date === date)
    .reverse();
  return (
    <section className="mt-6 space-y-5" aria-label="Journal grouped by date">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <CalendarDays size={20} className="text-primary" />
            Every day, in order
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            New entries and older imports appear on their original dates. Notes
            retain their saved date and timezone; trades use the timezone below.
          </p>
        </div>
        <div className="flex max-w-full flex-wrap gap-2">
          <label className="min-w-0 text-xs">
            Find a date
            <input
              aria-label="Find journal date"
              type="date"
              className="control-input mt-1 w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="min-w-0 text-xs">
            Trade dates
            <select
              aria-label="Trade grouping timezone"
              className="control-input mt-1 w-full max-w-[220px]"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              {[
                ...new Set([
                  "UTC",
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                  ...notes.map((n) => n.timeZone),
                ]),
              ]
                .sort()
                .map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
            </select>
          </label>
          {date && (
            <button
              className="btn-quiet min-h-11 self-end text-xs"
              onClick={() => setDate("")}
            >
              All dates
            </button>
          )}
        </div>
      </div>
      {!days.length && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No entries for this date yet. Earlier notes will appear here when you
          add or import them.
        </p>
      )}
      {days.map((day) => (
        <article
          key={day.date}
          className="overflow-hidden rounded-xl border border-border bg-card"
          data-journal-date={day.date}
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <h3 className="font-mono-custom text-sm font-semibold">
              {day.date}
            </h3>
            <p className="text-xs text-muted-foreground">
              {day.tradeIds.length} trades · {day.noteIds.length} notes
            </p>
          </header>
          <div className="grid gap-0 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="min-w-0 space-y-2 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trades
              </h4>
              {day.tradeIds.map((id) => {
                const t = trades.find((t) => t.id === id)!;
                return (
                  <button
                    key={id}
                    className="flex min-h-11 w-full min-w-0 items-start gap-2 rounded-lg bg-muted/30 p-3 text-left hover:bg-muted/60"
                    onClick={() => onTrade(t)}
                  >
                    <ArrowUpRight
                      size={16}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <span className="min-w-0 flex-1 break-words text-sm">
                      <strong>{t.symbol}</strong> · {t.side}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("en", {
                          timeZone: zone,
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(t.entryAt))}{" "}
                        · {t.strategy}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs ${t.pnl < 0 ? "text-destructive" : "text-primary"}`}
                    >
                      {t.pnl.toFixed(2)}
                    </span>
                  </button>
                );
              })}
              {!day.tradeIds.length && (
                <p className="text-xs text-muted-foreground">
                  No trades recorded on this day.
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-2 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes & logs
              </h4>
              {day.noteIds.map((id) => {
                const n = notes.find((n) => n.id === id)!;
                const linked = noteLinks(n, trades).linked;
                return (
                  <button
                    key={id}
                    className="flex min-h-11 w-full min-w-0 items-start gap-2 rounded-lg bg-muted/30 p-3 text-left hover:bg-muted/60"
                    onClick={() => onNote(n)}
                  >
                    <FileText
                      size={16}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <span className="min-w-0 flex-1 break-words text-sm">
                      <strong>{n.title}</strong>
                      <span className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                        {n.body}
                      </span>
                      <span className="mt-2 block text-xs text-primary">
                        {n.timeZone} · {linked.length} linked trades ·{" "}
                        {n.attachments.length} images
                      </span>
                    </span>
                  </button>
                );
              })}
              {!day.noteIds.length && (
                <p className="text-xs text-muted-foreground">
                  No notes recorded on this day.
                </p>
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
