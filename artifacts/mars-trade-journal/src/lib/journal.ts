import type { JournalNoteInput, Trade } from "@workspace/api-client-react";

export function journalDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function noteLinks(note: JournalNoteInput, trades: Trade[]) {
  const sameDay = trades.filter(
    (t) => journalDate(t.entryAt, note.timeZone) === note.date,
  );
  const linked =
    note.linkMode === "date"
      ? sameDay
      : trades.filter((t) => note.selectedTradeIds.includes(t.id));
  return {
    linked,
    missingTradeIds:
      note.linkMode === "selected"
        ? note.selectedTradeIds.filter((id) => !trades.some((t) => t.id === id))
        : [],
    changedDateTradeIds: linked
      .filter((t) => journalDate(t.entryAt, note.timeZone) !== note.date)
      .map((t) => t.id),
  };
}

export function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not read this image. Please select it again."));
    reader.readAsDataURL(blob);
  });
}

/** Notes retain their original calendar date; trade instants use an explicit display timezone. */
export function journalDays(
  trades: { id: number; entryAt: string }[],
  notes: { id: number; date: string }[],
  timeZone = "UTC",
) {
  const days = new Map<
    string,
    { date: string; tradeIds: number[]; noteIds: number[] }
  >();
  const day = (date: string) => {
    if (!days.has(date)) days.set(date, { date, tradeIds: [], noteIds: [] });
    return days.get(date)!;
  };
  for (const trade of [...trades].sort(
    (a, b) => a.entryAt.localeCompare(b.entryAt) || a.id - b.id,
  ))
    day(journalDate(trade.entryAt, timeZone)).tradeIds.push(trade.id);
  for (const note of [...notes].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  ))
    day(note.date).noteIds.push(note.id);
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
