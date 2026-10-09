// Normalize transport formatting only. Case, numbers, dates and links remain meaningful.
const text = (value: string | null | undefined) =>
  (value ?? "").normalize("NFC").trim().replace(/\s+/gu, " ");
export function tradeIdentity(t: {
  symbol: string;
  asset: string;
  side: string;
  lotSize: number | string;
  entryAt: Date | string;
  strategy: string;
  regime: string;
  pnl: number | string;
  notes?: string | null;
}) {
  return JSON.stringify([
    text(t.symbol).toUpperCase(),
    text(t.asset),
    t.side,
    Number(t.lotSize),
    new Date(t.entryAt).toISOString(),
    text(t.strategy),
    text(t.regime),
    Number(t.pnl),
    text(t.notes),
  ]);
}
export function imageIdentity(a: {
  name: string;
  caption: string;
  dataUrl: string;
}) {
  return JSON.stringify([text(a.name), text(a.caption), a.dataUrl]);
}
export function noteIdentity(n: {
  date: string;
  timeZone: string;
  title: string;
  body: string;
  linkMode: string;
  selectedTradeIds: number[];
  attachments: { name: string; caption: string; dataUrl: string }[];
}) {
  return JSON.stringify([
    n.date,
    n.timeZone,
    text(n.title),
    text(n.body),
    n.linkMode,
    [...new Set(n.selectedTradeIds)].sort((a, b) => a - b),
    n.attachments.map(imageIdentity).sort(),
  ]);
}
