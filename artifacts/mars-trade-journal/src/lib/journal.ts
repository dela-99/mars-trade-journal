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
