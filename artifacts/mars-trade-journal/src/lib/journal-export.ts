import type { JournalNote, Trade } from "@workspace/api-client-react";
import { journalDays, noteLinks, readDataUrl } from "./journal";
import type { LocalScreenshot } from "@/hooks/use-local-screenshots";

export async function buildJournalExport(
  trades: Trade[],
  notes: JournalNote[],
  legacy: LocalScreenshot[],
) {
  const attachments: Array<{
    id: string;
    noteId: number | null;
    tradeIds: number[];
    name: string;
    caption: string;
    path: string;
    dataUrl: string;
    source: string;
  }> = [];
  const orderedTrades = [...trades].sort(
    (a, b) => a.entryAt.localeCompare(b.entryAt) || a.id - b.id,
  );
  const orderedNotes = [...notes].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  );
  const exportedNotes = orderedNotes.map((note) => {
    const { attachments: images, ...fields } = note;
    const { linked, missingTradeIds, changedDateTradeIds } = noteLinks(
      note,
      trades,
    );
    for (const a of images)
      attachments.push({
        ...a,
        id: `note-${note.id}-${a.id}`,
        noteId: note.id,
        tradeIds: linked.map((t) => t.id),
        path: "",
        source: "journal-note",
      });
    return {
      ...fields,
      linkedTradeIds: linked.map((t) => t.id),
      missingTradeIds,
      changedDateTradeIds,
      attachmentIds: images.map((a) => `note-${note.id}-${a.id}`),
    };
  });
  for (const image of [...legacy].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )) {
    attachments.push({
      id: `legacy-${image.id}`,
      noteId: null,
      tradeIds: [image.tradeId],
      name: image.name,
      caption: "",
      dataUrl: await readDataUrl(image.blob),
      path: "",
      source: "browser-local-screenshot",
    });
  }
  attachments.forEach((a, index) => {
    const type = /^data:image\/([^;]+);base64,/.exec(a.dataUrl)?.[1] ?? "bin";
    const extension =
      (
        {
          png: "png",
          jpeg: "jpg",
          gif: "gif",
          webp: "webp",
          "svg+xml": "svg",
        } as Record<string, string>
      )[type] ?? "bin";
    a.path = `images/${String(index + 1).padStart(4, "0")}.${extension}`;
  });
  return {
    schemaVersion: "1.0",
    dateGroups: journalDays(orderedTrades, orderedNotes, "UTC"),
    groupingTimeZone: "UTC",
    groupingSemantics:
      "Date groups use UTC for trade timestamps and the original saved calendar date for notes. Each note retains its own timezone and linked trade IDs, including links across UTC dates.",
    exportedAt: new Date().toISOString(),
    dateSemantics:
      "Trade timestamps are ISO 8601 instants. Note dates are calendar days in each note.timeZone. Date links match trade entry times, never upload times. Selected links keep original IDs; missing and changed dates are flagged.",
    imageSemantics:
      "JSON contains image data URLs. CSV bundles contain image files referenced by path. Read captions with their images; image bytes are not OCR or a text interpretation.",
    legacyScreenshotScope:
      "Includes screenshots available in this browser only. Screenshots saved in other browsers are not accessible here.",
    trades: orderedTrades,
    notes: exportedNotes,
    attachments,
    orphanedAttachmentIds: attachments
      .filter((a) => a.tradeIds.some((id) => !trades.some((t) => t.id === id)))
      .map((a) => a.id),
  };
}
export type JournalExport = Awaited<ReturnType<typeof buildJournalExport>>;

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  // Keep actual numbers numeric, while blocking formulas hidden after whitespace.
  if (typeof value !== "number" && /^[\s\uFEFF]*[=+\-@]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function journalCsv(data: JournalExport) {
  const headers = [
    "record_type",
    "id",
    "trade_ids",
    "note_id",
    "date",
    "timezone",
    "title",
    "text",
    "symbol",
    "asset",
    "side",
    "lot_size",
    "pnl",
    "strategy",
    "regime",
    "link_mode",
    "selected_trade_ids",
    "missing_trade_ids",
    "changed_date_trade_ids",
    "attachment_ids",
    "image_path",
    "image_name",
    "created_at",
    "updated_at",
  ];
  const rows: Record<string, unknown>[] = [
    ...data.trades.map((t) => ({
      record_type: "trade",
      id: t.id,
      trade_ids: JSON.stringify([t.id]),
      date: t.entryAt,
      timezone: "UTC",
      text: t.notes,
      symbol: t.symbol,
      asset: t.asset,
      side: t.side,
      lot_size: t.lotSize,
      pnl: t.pnl,
      strategy: t.strategy,
      regime: t.regime,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })),
    ...data.notes.map((n) => ({
      record_type: "note",
      id: n.id,
      note_id: n.id,
      trade_ids: JSON.stringify(n.linkedTradeIds),
      date: n.date,
      timezone: n.timeZone,
      title: n.title,
      text: n.body,
      link_mode: n.linkMode,
      selected_trade_ids: JSON.stringify(n.selectedTradeIds),
      missing_trade_ids: JSON.stringify(n.missingTradeIds),
      changed_date_trade_ids: JSON.stringify(n.changedDateTradeIds),
      attachment_ids: JSON.stringify(n.attachmentIds),
      created_at: n.createdAt,
      updated_at: n.updatedAt,
    })),
    ...data.attachments.map((a) => ({
      record_type: "attachment",
      id: a.id,
      trade_ids: JSON.stringify(a.tradeIds),
      note_id: a.noteId,
      text: a.caption,
      image_path: a.path,
      image_name: a.name,
    })),
  ];
  // Keep related records beside their original date in the CSV, including backdated imports.
  const tradeDates = new Map(
    data.trades.map((t) => [
      t.id,
      new Date(t.entryAt).toISOString().slice(0, 10),
    ]),
  );
  const noteDates = new Map(data.notes.map((n) => [n.id, n.date]));
  const rowDate = (row: Record<string, unknown>) =>
    row.record_type === "attachment"
      ? (noteDates.get(Number(row.note_id)) ??
        tradeDates.get(JSON.parse(String(row.trade_ids))[0]) ??
        "9999-12-31")
      : row.record_type === "trade"
        ? new Date(String(row.date)).toISOString().slice(0, 10)
        : String(row.date);
  rows.sort((a, b) => rowDate(a).localeCompare(rowDate(b)));
  return (
    "\uFEFF" +
    [headers, ...rows.map((row) => headers.map((key) => row[key]))]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}

export async function csvBundle(data: JournalExport) {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {
    "journal.csv": strToU8(journalCsv(data)),
    "manifest.json": strToU8(
      JSON.stringify(
        {
          ...data,
          attachments: data.attachments.map(({ dataUrl: _, ...a }) => a),
        },
        null,
        2,
      ),
    ),
    "README.txt": strToU8(
      "M.A.R.S. journal export\nOpen journal.csv or manifest.json and supply the images folder to your AI alongside them.\nRows are typed: trade, note, attachment. IDs connect notes, trades and images.\nDates and link rules are documented in manifest.json. Captions describe images but are not OCR.\nSpreadsheet formula protection prefixes risky text cells with an apostrophe; manifest.json preserves exact text.\n" +
        data.legacyScreenshotScope,
    ),
  };
  for (const image of data.attachments) {
    const encoded = image.dataUrl.split(",")[1];
    if (!encoded || !image.dataUrl.includes(";base64,"))
      throw new Error(`Cannot export image ${image.name}.`);
    files[image.path] = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  }
  return zipSync(files, { level: 0 });
}

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function printableJournal(data: JournalExport) {
  const e = escapeHtml;
  const imageHtml = (a: JournalExport["attachments"][number]) =>
    `<figure><figcaption><strong>${e(a.name)}</strong> · ${e(a.id)} · Trades: ${e(a.tradeIds.join(", ") || "none")}<p>${e(a.caption)}</p></figcaption>${/^data:image\/(png|jpeg|webp|gif);base64,/.test(a.dataUrl) ? `<img src="${e(a.dataUrl)}" alt="${e(a.caption || a.name)}">` : "<p>Image format available in JSON/CSV bundle.</p>"}</figure>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>MARS trade journal</title><style>body{font:14px/1.6 system-ui,sans-serif;color:#182d29;max-width:1000px;margin:40px auto;padding:0 24px}h1,h2,h3{line-height:1.2}article{border-top:1px solid #cbd5d1;padding:20px 0}p,td,figcaption{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5d1;padding:6px;text-align:left}img{display:block;max-width:100%;max-height:650px;object-fit:contain}figure{margin:20px 0;break-inside:avoid}h2,h3{break-after:avoid}button{padding:12px 20px;cursor:pointer}@media print{.print-controls{display:none}body{margin:0;max-width:none;padding:0}img{max-height:220mm}}@page{margin:16mm}</style></head><body><div class="print-controls"><button id="save-pdf">Print / Save as PDF</button><p>Choose “Save as PDF” in the print dialog. The report includes selectable text and screenshots.</p></div><h1>M.A.R.S. — Complete journal</h1><p>Exported ${e(data.exportedAt)} · ${data.trades.length} trades · ${data.notes.length} notes · ${data.attachments.length} screenshots</p><p>${e(data.dateSemantics)}</p><p>${e(data.legacyScreenshotScope)}</p><h2>Trades</h2>${data.trades
    .map(
      (t) =>
        `<article><h3>Trade #${t.id} · ${e(t.symbol)} · ${e(t.side)}</h3><p>${e(t.entryAt)} (UTC) · ${e(t.asset)} · Lots: ${t.lotSize} · P&amp;L: ${t.pnl}</p><p>Strategy: ${e(t.strategy)} · Regime: ${e(t.regime)}</p><p>${e(t.notes)}</p><p>Linked notes: ${e(
          data.notes
            .filter((n) => n.linkedTradeIds.includes(t.id))
            .map((n) => `#${n.id}`)
            .join(", ") || "none",
        )}</p></article>`,
    )
    .join("")}<h2>Dated notes</h2>${data.notes
    .map(
      (n) =>
        `<article><h3>Note #${n.id} · ${e(n.title)}</h3><p>${e(n.date)} · ${e(n.timeZone)} · Linking: ${e(n.linkMode)}</p><p>Trades: ${e(n.linkedTradeIds.join(", ") || "none")} · Missing: ${e(n.missingTradeIds.join(", ") || "none")} · Changed date: ${e(n.changedDateTradeIds.join(", ") || "none")}</p><p>${e(n.body)}</p>${data.attachments
          .filter((a) => a.noteId === n.id)
          .map(imageHtml)
          .join("")}</article>`,
    )
    .join("")}<h2>Earlier browser screenshots</h2>${data.attachments
    .filter((a) => a.noteId === null)
    .map(imageHtml)
    .join(
      "",
    )}${data.orphanedAttachmentIds.length ? `<p>Images with deleted trade links: ${e(data.orphanedAttachmentIds.join(", "))}</p>` : ""}</body></html>`;
}

export function downloadFile(
  content: BlobPart,
  type: string,
  filename: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
