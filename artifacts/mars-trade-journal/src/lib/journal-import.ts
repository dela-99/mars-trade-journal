import Papa from "papaparse";

export type ImportTrade = {
  id: number;
  symbol: string;
  asset: string;
  side: "buy" | "sell";
  lotSize: number;
  entryAt: string;
  strategy: string;
  regime: string;
  pnl: number;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
};
export type ImportNote = {
  id: number;
  date: string;
  timeZone: string;
  title: string;
  body: string;
  linkMode: "date" | "selected";
  selectedTradeIds: number[];
  attachments: { id: string; name: string; caption: string; dataUrl: string }[];
  createdAt?: string;
  updatedAt?: string;
};
export type ImportData = {
  trades: ImportTrade[];
  notes: ImportNote[];
  warnings: string[];
  preserveIdenticalTrades?: boolean;
};
const number = (value: string) => {
  if (!value.trim() || !Number.isFinite(Number(value)))
    throw new Error(`Invalid number: ${value || "(empty)"}`);
  return Number(value);
};
const ids = (s: string) => (s ? (JSON.parse(s) as number[]) : []);
const unprotect = (s: string) =>
  /^'[\s\uFEFF]*[=+\-@]/.test(s) ? s.slice(1) : s;

export function parseJournalCsv(text: string): ImportData {
  const legacyHeaders: Record<string, string> = {
    Symbol: "symbol",
    Asset: "asset",
    Side: "side",
    "Lot size": "lot_size",
    "Entry date": "date",
    Strategy: "strategy",
    "Market regime": "regime",
    "P&L": "pnl",
    Notes: "notes",
  };
  const originalLegacy = text
    .replace(/^\uFEFF/, "")
    .startsWith('"Symbol","Asset",');
  const result = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) =>
        legacyHeaders[header.trim()] ?? header.trim(),
    },
  );
  if (result.errors.length)
    throw new Error(`CSV could not be read: ${result.errors[0].message}`);
  const headers = result.meta.fields ?? [];
  if (
    new Set(headers).size !== headers.length ||
    Object.keys(result.meta.renamedHeaders ?? {}).length
  )
    throw new Error("CSV column names must be unique.");
  const modern = headers.includes("record_type");
  if (
    !["symbol", "asset", "side", "strategy", "regime", "pnl"].every((h) =>
      headers.includes(h),
    ) ||
    !(headers.includes("date") || headers.includes("entryAt")) ||
    !(headers.includes("lot_size") || headers.includes("lotSize"))
  )
    throw new Error(
      "Use a M.A.R.S. CSV with symbol, asset, side, lot_size (or lotSize), date (or entryAt), strategy, regime and pnl columns.",
    );
  const data: ImportData = { trades: [], notes: [], warnings: [] };
  for (const [index, raw] of result.data.entries()) {
    const row = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k,
        modern || originalLegacy ? unprotect(v) : v,
      ]),
    );
    const type = modern ? row.record_type : "trade";
    if (type === "trade")
      data.trades.push({
        id: row.id ? number(row.id) : index + 1,
        symbol: row.symbol,
        asset: row.asset,
        side: row.side.toLowerCase() as "buy" | "sell",
        lotSize: number(row.lot_size ?? row.lotSize),
        entryAt: row.date ?? row.entryAt,
        strategy: row.strategy,
        regime: row.regime,
        pnl: number(row.pnl),
        notes: (row.text ?? row.notes) || null,
        createdAt: row.created_at || row.createdAt || undefined,
        updatedAt: row.updated_at || row.updatedAt || undefined,
      });
    else if (type === "note")
      data.notes.push({
        id: number(row.id),
        date: row.date,
        timeZone: row.timezone,
        title: row.title,
        body: row.text,
        linkMode: row.link_mode as "date" | "selected",
        selectedTradeIds: ids(row.selected_trade_ids),
        attachments: [],
        createdAt: row.created_at || undefined,
        updatedAt: row.updated_at || undefined,
      });
    else if (type === "attachment") {
      if (!data.warnings.length)
        data.warnings.push(
          "This CSV references screenshots but does not contain their bytes. Import the original CSV ZIP or JSON to restore images.",
        );
    } else throw new Error(`Row ${index + 2}: unknown record_type ${type}.`);
  }
  if (!modern)
    data.warnings.push(
      "Trade-only CSV: notes and images can only be restored when included in the backup.",
    );
  return data;
}

export function parseJournalJson(text: string): ImportData {
  const raw = JSON.parse(text);
  if (
    raw.schemaVersion !== "1.0" ||
    !Array.isArray(raw.trades) ||
    !Array.isArray(raw.notes) ||
    !Array.isArray(raw.attachments)
  )
    throw new Error(
      "This is not a supported M.A.R.S. journal backup (schema 1.0).",
    );
  const data: ImportData = { trades: raw.trades, notes: [], warnings: [] };
  const attached = new Set<string>();
  for (const note of raw.notes) {
    const images = raw.attachments.filter(
      (a: { noteId: number }) => a.noteId === note.id,
    );
    if (
      JSON.stringify([...images.map((a: { id: string }) => a.id)].sort()) !==
      JSON.stringify([...(note.attachmentIds ?? [])].sort())
    )
      throw new Error(
        `Note ${note.id} has missing or inconsistent screenshot references.`,
      );
    data.notes.push({
      ...note,
      attachments: images.map(
        (a: { id: string; name: string; caption: string; dataUrl: string }) => {
          attached.add(a.id);
          return {
            ...a,
            id: a.id.replace(new RegExp(`^note-${note.id}-`), ""),
          };
        },
      ),
    });
  }
  // Move older browser-only images into dated, server-saved notes during restoration.
  let nextId = Math.max(0, ...data.notes.map((n) => n.id)) + 1;
  for (const a of raw.attachments) {
    if (attached.has(a.id)) continue;
    if (a.noteId !== null)
      throw new Error("An image references a note missing from the backup.");
    const trade = data.trades.find((t) => a.tradeIds.includes(t.id));
    if (!trade)
      throw new Error(
        "A legacy screenshot references a deleted trade. Restore it separately before importing this backup.",
      );
    data.notes.push({
      id: nextId++,
      date: new Date(trade.entryAt).toISOString().slice(0, 10),
      timeZone: "UTC",
      title: `Screenshot: ${a.name}`.slice(0, 200),
      body: "Restored from an earlier browser screenshot.",
      linkMode: "selected",
      selectedTradeIds: [trade.id],
      attachments: [
        {
          id: crypto.randomUUID(),
          name: a.name,
          caption: a.caption,
          dataUrl: a.dataUrl,
        },
      ],
      createdAt: trade.createdAt,
    });
  }
  return data;
}

export async function parseJournalZip(bytes: Uint8Array): Promise<ImportData> {
  const { unzipSync, strFromU8 } = await import("fflate");
  let expanded = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      expanded += entry.originalSize;
      if (expanded > 100 * 1024 * 1024)
        throw new Error("Expanded backup exceeds 100 MB.");
      return true;
    },
  });
  if (!files["manifest.json"])
    throw new Error("ZIP must contain the M.A.R.S. manifest.json and images.");
  const raw = JSON.parse(strFromU8(files["manifest.json"]));
  if (!Array.isArray(raw.attachments))
    throw new Error("Invalid backup manifest.");
  for (const image of raw.attachments) {
    const bytes = files[image.path];
    if (!bytes || !/^images\/[^/]+\.(png|jpg|jpeg|gif|webp)$/.test(image.path))
      throw new Error(`Missing or unsupported image: ${image.path}`);
    const extension = image.path.split(".").pop();
    const mime = extension === "jpg" ? "jpeg" : extension;
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    image.dataUrl = `data:image/${mime};base64,${btoa(binary)}`;
  }
  return parseJournalJson(JSON.stringify(raw));
}

export async function readImportFile(file: File): Promise<ImportData> {
  if (file.size > 40 * 1024 * 1024)
    throw new Error("Import files must be 40 MB or smaller.");
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "csv") return parseJournalCsv(await file.text());
  if (ext === "json") return parseJournalJson(await file.text());
  if (ext === "zip")
    return parseJournalZip(new Uint8Array(await file.arrayBuffer()));
  if (ext === "pdf") {
    const { readJournalPdf } = await import("./journal-pdf");
    return readJournalPdf(new Uint8Array(await file.arrayBuffer()));
  }
  throw new Error("Choose a CSV, CSV ZIP, JSON or PDF journal backup.");
}
