import Papa from "papaparse";
import type { ImportData, ImportNote } from "./journal-import";
export type DateOrder = "iso" | "day-first" | "month-first";
export type ExternalCsv = { headers: string[]; rows: Record<string, string>[] };
export function externalCsv(text: string): ExternalCsv {
  const result = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    },
  );
  if (
    result.errors.length ||
    Object.keys(result.meta.renamedHeaders ?? {}).length
  )
    throw new Error(
      "CSV has malformed rows or duplicate column headings. Correct the file and try again.",
    );
  const headers = result.meta.fields ?? [];
  if (!headers.length || !result.data.length || result.data.length > 1000)
    throw new Error(
      "Choose a CSV with column headings and between 1 and 1,000 rows.",
    );
  return { headers, rows: result.data };
}
export function externalDate(
  value: string,
  order: DateOrder,
  timeZone: string,
): string {
  const raw = value.trim();
  if (!raw) throw new Error("A journal date is required.");
  // Instants with explicit offsets are translated to the chosen trading timezone.
  if (/^\d{4}-\d\d-\d\dT/.test(raw)) {
    const match =
      /^(\d{4}-\d\d-\d\d)T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
        raw,
      );
    if (!match || !validDate(match[1]) || !Number.isFinite(Date.parse(raw)))
      throw new Error(
        "Timestamps must be valid and include Z or a timezone offset.",
      );
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(raw));
  }
  // MT5's Journal/Experts table uses the original computer's local datetime.
  const local =
    /^(\d{4})[.-](\d\d)[.-](\d\d)(?:[ T](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?)?$/.exec(
      raw,
    );
  if (local) {
    const date = `${local[1]}-${local[2]}-${local[3]}`;
    if (!validDate(date)) throw new Error(`Invalid calendar date: ${raw}`);
    return date;
  }
  let date = raw;
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) {
    const parts = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(raw);
    if (!parts || order === "iso")
      throw new Error(
        "Use YYYY-MM-DD or select the date order used in the file.",
      );
    const month = order === "day-first" ? parts[2] : parts[1],
      day = order === "day-first" ? parts[1] : parts[2];
    date = `${parts[3]}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (!validDate(date)) throw new Error(`Invalid calendar date: ${raw}`);
  return date;
}
function validDate(date: string) {
  const parsed = new Date(date + "T12:00:00Z");
  return (
    date.slice(0, 4) !== "0000" &&
    Number.isFinite(+parsed) &&
    parsed.toISOString().slice(0, 10) === date
  );
}
export function csvNotes(
  csv: ExternalCsv,
  options: {
    dateColumn: string;
    titleColumn: string;
    bodyColumn: string;
    timeZone: string;
    dateOrder: DateOrder;
    fallbackDate?: string;
  },
): ImportNote[] {
  if (!csv.headers.includes(options.dateColumn))
    throw new Error("Choose the column containing the original journal date.");
  new Intl.DateTimeFormat("en", { timeZone: options.timeZone }).format();
  const sourceColumn = csv.headers.find((h) => /^source$/i.test(h));
  const messageColumn = csv.headers.find((h) => /^message$/i.test(h));
  const mt5 =
    sourceColumn &&
    messageColumn &&
    /^(time|date|timestamp)$/i.test(options.dateColumn) &&
    options.bodyColumn === messageColumn;
  return csv.rows.map((row, index) => {
    const timestamp = row[options.dateColumn].trim();
    const timeOnly = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/.test(
      timestamp,
    );
    let date: string;
    try {
      date = externalDate(
        timeOnly ? (options.fallbackDate ?? "") : timestamp,
        options.dateOrder,
        options.timeZone,
      );
    } catch (e) {
      throw new Error(`Row ${index + 2}: ${(e as Error).message}`);
    }
    const remaining = csv.headers.filter(
      (h) =>
        ![options.dateColumn, options.titleColumn, options.bodyColumn].includes(
          h,
        ) && row[h]?.trim(),
    );
    if (mt5) {
      const extra = csv.headers
        .filter(
          (h) =>
            ![options.dateColumn, sourceColumn, messageColumn].includes(h) &&
            row[h]?.trim(),
        )
        .sort()
        .map((h) => `${h}: ${row[h]}`)
        .join("\n");
      const logTime = timestamp.replace(/^\d{4}[.-]\d\d[.-]\d\d[ T]/, "");
      return {
        id: index + 1,
        date,
        timeZone: options.timeZone,
        title: row[options.titleColumn]?.trim() || "MetaTrader 5 log",
        body: `${date} ${logTime} ${row[sourceColumn!].trim()} ${row[messageColumn!].trim()}${extra ? "\n" + extra : ""}`,
        linkMode: "date",
        selectedTradeIds: [],
        attachments: [],
      };
    }
    const body = [
      timestamp.includes(":") ? `Timestamp: ${timestamp}` : undefined,
      row[options.bodyColumn]?.trim(),
      ...remaining.map((h) => `${h}: ${row[h]}`),
    ]
      .filter(Boolean)
      .join("\n\n");
    const title = row[options.titleColumn]?.trim() || "Imported note";
    if (!body && title === "Imported note")
      throw new Error(`Row ${index + 2}: no note or data to import.`);
    return {
      id: index + 1,
      date,
      timeZone: options.timeZone,
      title,
      body,
      linkMode: "date",
      selectedTradeIds: [],
      attachments: [],
    };
  });
}
// Split only explicit date headings. Ambiguous or undated material stays editable,
// with an empty date that must be supplied before preview; never use the upload day.
export function pdfNotes(
  text: string,
  timeZone: string,
  order: DateOrder,
): ImportNote[] {
  if (!text.trim())
    throw new Error(
      "No readable text was found. A scanned PDF needs OCR or a CSV export from the original app.",
    );
  const notes: ImportNote[] = [];
  let lines: string[] = [],
    date = "",
    title = "Imported note";
  const flush = () => {
    if (lines.join("\n").trim())
      notes.push({
        id: notes.length + 1,
        date,
        timeZone,
        title,
        body: lines.join("\n").trim(),
        linkMode: "date",
        selectedTradeIds: [],
        attachments: [],
      });
    lines = [];
  };
  const mt5Table = /\bTime\s+Source\s+Message\b/i.test(text);
  const withoutHeaders = text.replace(/^\s*Time\s+Source\s+Message\s*$/gim, "");
  for (const line of withoutHeaders.split("\n")) {
    // MT5 table rows contain their own date and local time. Keep the full row,
    // including source and message, so two otherwise identical events at different times stay distinct.
    const log =
      /^\s*(\d{4}[.-]\d\d[.-]\d\d)[ T]((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?)(?:\s+(.+))?\s*$/.exec(
        line,
      );
    if (log) {
      flush();
      date = externalDate(log[1], order, timeZone);
      title = "MetaTrader 5 log";
      lines = [`${date} ${log[2]} ${log[3]?.trim() ?? ""}`];
      continue;
    }
    const clock =
      /^\s*((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?)(?:\s+(.+))?\s*$/.exec(
        line,
      );
    if (mt5Table && date && clock) {
      flush();
      title = "MetaTrader 5 log";
      lines = [`${date} ${clock[1]} ${clock[2]?.trim() ?? ""}`];
      continue;
    }
    const heading =
      /^\s*(?:Date:\s*)?(\d{4}[.-]\d\d[.-]\d\d|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})(?:\s+[—–|]\s*(.+))?\s*$/.exec(
        line,
      );
    if (heading) {
      try {
        const parsed = externalDate(heading[1], order, timeZone);
        flush();
        date = parsed;
        title = heading[2]?.trim() || "Imported note";
        continue;
      } catch {
        flush();
        date = "";
        title =
          "Imported note"; /* Require a date for the unparsed heading and its following text. */
      }
    }
    lines.push(line);
  }
  flush();
  if (notes.length > 1000)
    throw new Error(
      "PDF exceeds 1,000 dated sections. Split the source document.",
    );
  return notes;
}
export function externalData(
  notes: ImportNote[],
  timeZone: string,
): ImportData {
  if (!notes.length) throw new Error("Select at least one note to import.");
  new Intl.DateTimeFormat("en", { timeZone }).format();
  return {
    trades: [],
    notes: notes.map((n, i) => ({
      ...n,
      id: i + 1,
      date: externalDate(n.date, "iso", timeZone),
      timeZone,
    })),
    warnings: [
      "External data is saved as notes and linked to every trade on its original date in the chosen timezone. PDF text extraction does not restore embedded screenshots. Review all dates and text before confirming.",
    ],
  };
}

export async function readExternalText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Spreadsheet/log exports may be UTF-16 with a BOM. Never silently decode them as UTF-8.
  const encoding =
    bytes[0] === 255 && bytes[1] === 254
      ? "utf-16le"
      : bytes[0] === 254 && bytes[1] === 255
        ? "utf-16be"
        : "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      "Text encoding is not supported. Export the CSV as UTF-8 or UTF-16.",
    );
  }
}
