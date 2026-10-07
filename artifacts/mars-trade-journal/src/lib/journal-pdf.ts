import { journalDays } from "./journal";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { JournalExport } from "./journal-export";
import { parseJournalJson, type ImportData } from "./journal-import";

/** The embedded JSON is authoritative for lossless recovery; visible pages remain readable. */
export async function createJournalPdf(data: JournalExport) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("M.A.R.S. journal backup");
  pdf.setSubject(
    "Readable journal with embedded mars-journal.json for exact restoration",
  );
  await pdf.attach(
    new TextEncoder().encode(JSON.stringify(data)),
    "mars-journal.json",
    {
      mimeType: "application/json",
      description:
        "Complete journal backup, including original screenshots and links",
    },
  );
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  let replaced = false;
  const safe = (text: string) =>
    Array.from(text)
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          replaced = true;
          return "?";
        }
      })
      .join("");
  function line(text: string, size = 10, strong = false) {
    const normalized = safe(text).replace(/\r/g, "");
    for (const paragraph of normalized.split("\n")) {
      let row = "";
      for (const character of paragraph) {
        if (font.widthOfTextAtSize(row + character, size) > 491) {
          draw(row, size, strong);
          row = "";
        }
        row += character;
      }
      draw(row, size, strong);
    }
  }
  function draw(text: string, size: number, strong: boolean) {
    if (y < size + 55) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    page.drawText(text, {
      x: 52,
      y,
      size,
      font: strong ? bold : font,
      color: rgb(0.12, 0.18, 0.2),
    });
    y -= size + 6;
  }
  async function image(dataUrl: string) {
    let embedded;
    if (dataUrl.startsWith("data:image/png;"))
      embedded = await pdf.embedPng(dataUrl);
    else if (dataUrl.startsWith("data:image/jpeg;"))
      embedded = await pdf.embedJpg(dataUrl);
    else {
      const bitmap = await createImageBitmap(
        await (await fetch(dataUrl)).blob(),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Cannot render screenshot.");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      embedded = await pdf.embedPng(canvas.toDataURL("image/png"));
    }
    const size = embedded.scale(
      Math.min(491 / embedded.width, 400 / embedded.height, 1),
    );
    if (y - size.height < 55) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    page.drawImage(embedded, {
      x: 52,
      y: y - size.height,
      width: size.width,
      height: size.height,
    });
    y -= size.height + 20;
  }
  line("M.A.R.S. — Complete journal", 22, true);
  line(data.exportedAt);
  line(
    `${data.trades.length} trades | ${data.notes.length} notes | ${data.attachments.length} screenshots`,
  );
  line(
    "Recoverable PDF: import this original file to restore your complete journal.",
  );
  line("Reprinting or editing the PDF may remove its embedded backup.");
  y -= 12;
  for (const day of journalDays(data.trades, data.notes, "UTC")) {
    line(day.date, 18, true);
    line(
      "Trades: UTC dates. Notes: original journal dates; each note retains its timezone.",
    );
    for (const t of data.trades.filter((t) => day.tradeIds.includes(t.id))) {
      line(`Trade #${t.id} | ${t.symbol} | ${t.side}`, 14, true);
      line(`${t.entryAt} | ${t.asset} | Lots: ${t.lotSize} | P&L: ${t.pnl}`);
      line(`Strategy: ${t.strategy} | Regime: ${t.regime}`);
      line(t.notes ?? "");
      y -= 12;
    }
    for (const n of data.notes.filter((n) => day.noteIds.includes(n.id))) {
      line(`Note #${n.id} | ${n.title}`, 14, true);
      line(`${n.date} | ${n.timeZone} | Linking: ${n.linkMode}`);
      line(
        `Trades: ${n.linkedTradeIds.join(", ") || "none"} | Missing: ${n.missingTradeIds.join(", ") || "none"}`,
      );
      line(n.body);
      for (const a of data.attachments.filter((a) => a.noteId === n.id)) {
        line(`${a.name} | ${a.caption}`);
        await image(a.dataUrl);
      }
      y -= 12;
    }
  }
  for (const a of data.attachments.filter((a) => a.noteId === null)) {
    line(`Earlier screenshot | Trades: ${a.tradeIds.join(", ")}`);
    line(`${a.name} | ${a.caption}`);
    await image(a.dataUrl);
  }
  if (replaced)
    line(
      "Some characters are unavailable in the report font. The embedded JSON preserves the original text exactly.",
    );
  return pdf.save();
}

// Older browser-printed M.A.R.S. reports do not include an embedded backup.
// Recognize only our own labels; arbitrary/scanned reports are never guessed into trade records.
export function parseLegacyPdfText(text: string): ImportData {
  if (!/M\.A\.R\.S\./.test(text) || !/Complete journal/.test(text))
    throw new Error(
      "This PDF is not a recognized M.A.R.S. report. Use a M.A.R.S. backup or convert its table to CSV first.",
    );
  const data: ImportData = {
    trades: [],
    notes: [],
    warnings: [
      "Older printed PDF: text recovery only. Screenshots, original timestamps and exact whitespace cannot be recovered. Review every imported entry.",
    ],
  };
  const tradePattern =
    /Trade #(\d+)\s*[·|]\s*(.*?)\s*[·|]\s*(buy|sell)\s+(\d{4}-\d\d-\d\dT\S+)\s*\(UTC\)\s*[·|]\s*(.*?)\s*[·|]\s*Lots:\s*([\d.eE+-]+)\s*[·|]\s*P&L:\s*([\d.eE+-]+)\s+Strategy:\s*(.*?)\s*[·|]\s*Regime:\s*(.*?)\s*\n([\s\S]*?)Linked notes:\s*[^\n]*/g;
  for (const match of text.matchAll(tradePattern))
    data.trades.push({
      id: Number(match[1]),
      symbol: match[2].trim(),
      side: match[3] as "buy" | "sell",
      entryAt: match[4],
      asset: match[5].trim(),
      lotSize: Number(match[6]),
      pnl: Number(match[7]),
      strategy: match[8].trim(),
      regime: match[9].trim(),
      notes: match[10].trim() || null,
    });
  const notePattern =
    /Note #(\d+)\s*[·|]\s*(.*?)\n(\d{4}-\d\d-\d\d)\s*[·|]\s*(\S+)\s*[·|]\s*Linking:\s*(date|selected)\s+Trades:\s*(.*?)\s*[·|]\s*Missing:\s*(.*?)\s*[·|]\s*Changed date:\s*([^\n]*)\n([\s\S]*?)(?=\nNote #|\nEarlier browser screenshots|$)/g;
  for (const match of text.matchAll(notePattern)) {
    const numbers = (value: string) => value.match(/\d+/g)?.map(Number) ?? [];
    const mode = match[5] as "date" | "selected";
    data.notes.push({
      id: Number(match[1]),
      title: match[2].trim(),
      date: match[3],
      timeZone: match[4],
      linkMode: mode,
      selectedTradeIds:
        mode === "selected"
          ? [
              ...new Set([
                ...numbers(match[6]),
                ...numbers(match[7]),
                ...numbers(match[8]),
              ]),
            ]
          : [],
      attachments: [],
      body: match[9].split(/\n[^\n]*· note-\d+-/)[0].trim(),
    });
  }
  const declared = /·\s*(\d+) trades\s*·\s*(\d+) notes/.exec(text);
  if (
    !declared ||
    Number(declared[1]) !== data.trades.length ||
    Number(declared[2]) !== data.notes.length ||
    (!data.trades.length && !data.notes.length)
  )
    throw new Error(
      "This older PDF could not be read completely. No data was imported. Use the original CSV/JSON backup or convert its text to CSV.",
    );
  return data;
}

export async function readJournalPdf(bytes: Uint8Array): Promise<ImportData> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;
  try {
    if (doc.numPages > 1000) throw new Error("PDF exceeds 1,000 pages.");
    const attachments = await doc.getAttachments();
    const backup = [...(attachments?.entries() ?? [])].find(
      ([, a]) => a.filename === "mars-journal.json",
    );
    if (backup) {
      const content = await doc.getAttachmentContent(backup[0]);
      if (!content)
        throw new Error("The PDF backup attachment is empty or damaged.");
      if (content.length > 100 * 1024 * 1024)
        throw new Error("Embedded backup exceeds 100 MB.");
      return parseJournalJson(new TextDecoder().decode(content));
    }
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items)
        if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
      text += "\n";
    }
    return parseLegacyPdfText(text);
  } finally {
    await task.destroy();
  }
}

export async function externalPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const doc = await task.promise;
    if (doc.numPages > 1000) throw new Error("PDF exceeds 1,000 pages.");
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      for (const item of content.items)
        if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
      text += "\n";
      if (text.length > 2_000_000)
        throw new Error(
          "PDF text exceeds 2 million characters. Split the document.",
        );
    }
    return text;
  } finally {
    await task.destroy();
  }
}
