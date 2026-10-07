import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJournalExport, journalCsv, csvBundle } from "./journal-export";
import {
  parseJournalCsv,
  parseJournalJson,
  parseJournalZip,
} from "./journal-import";
import { parseLegacyPdfText } from "./journal-pdf";

const timestamp = "2026-10-07T12:00:00.000Z";
const trade = {
  id: 17,
  symbol: "EURUSD",
  asset: "forex",
  side: "buy" as const,
  lotSize: 0.1,
  entryAt: timestamp,
  strategy: "breakout",
  regime: "trend",
  pnl: -25,
  notes: 'Comma, "quote"\n日本語',
  createdAt: timestamp,
  updatedAt: timestamp,
};
const image = {
  id: "56b777d6-ecdf-4ba3-bb07-59825375f1f9",
  name: "chart.png",
  caption: "Entry, exit",
  dataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
};
const note = {
  id: 22,
  date: "2026-10-07",
  timeZone: "UTC",
  title: "=SUM(A1)",
  body: "Review\nSecond line",
  linkMode: "selected" as const,
  selectedTradeIds: [17],
  attachments: [image],
  createdAt: timestamp,
  updatedAt: timestamp,
};

test("CSV keeps dates, negative P&L, quoted multiline text, Unicode and selected links; warns about missing image bytes", async () => {
  const exported = await buildJournalExport([trade], [note], []);
  const restored = parseJournalCsv(journalCsv(exported));
  assert.deepEqual(restored.trades, [trade]);
  assert.equal(restored.notes[0].title, note.title);
  assert.equal(restored.notes[0].body, note.body);
  assert.deepEqual(restored.notes[0].selectedTradeIds, [17]);
  assert.equal(restored.warnings.length, 1);
});
test("original app CSV headers and apostrophe-protected negative numbers restore correctly", () => {
  const data = parseJournalCsv(
    '"Symbol","Asset","Side","Lot size","Entry date","Strategy","Market regime","P&L","Notes"\r\n"EURUSD","forex","buy","0.1","2026-10-07T12:00:00Z","breakout","trend","\'-25","a,b"',
  );
  assert.equal(data.trades[0].pnl, -25);
  assert.equal(data.trades[0].notes, "a,b");
});
test("JSON and CSV ZIP roundtrip exact original screenshots, captions and note links", async () => {
  const exported = await buildJournalExport([trade], [note], []);
  for (const restored of [
    parseJournalJson(JSON.stringify(exported)),
    await parseJournalZip(await csvBundle(exported)),
  ]) {
    assert.deepEqual(restored.trades, [trade]);
    assert.deepEqual(
      restored.notes[0].attachments.map(({ id, name, caption, dataUrl }) => ({
        id,
        name,
        caption,
        dataUrl,
      })),
      [image],
    );
    assert.deepEqual(restored.notes[0].selectedTradeIds, [17]);
  }
});
test("malformed and partial backups fail explicitly", async () => {
  assert.throws(() => parseJournalCsv("foo,bar\n1,2"), /M.A.R.S/);
  assert.throws(() => parseJournalJson('{"schemaVersion":"99"}'), /supported/);
  const exported = await buildJournalExport([trade], [note], []);
  exported.attachments = [];
  assert.throws(
    () => parseJournalJson(JSON.stringify(exported)),
    /screenshot references/,
  );
  assert.throws(
    () =>
      parseJournalCsv(
        "symbol,asset,side,lot_size,date,strategy,regime,pnl\nEURUSD,forex,buy,no,2026-10-07T12:00:00Z,s,r,0",
      ),
    /Invalid number/,
  );
});
test("recognized older PDF text restores all declared records; partial and arbitrary PDFs fail", () => {
  const text =
    "M.A.R.S. — Complete journal\nExported today · 1 trades · 1 notes · 0 screenshots\nTrades\nTrade #17 · EURUSD · buy\n2026-10-07T12:00:00Z (UTC) · forex · Lots: 0.1 · P&L: -25\nStrategy: breakout · Regime: trend\nReflection\nLinked notes: #22\nDated notes\nNote #22 · Review\n2026-10-07 · UTC · Linking: selected\nTrades: 17 · Missing: none · Changed date: none\nMy reflection\nEarlier browser screenshots";
  const data = parseLegacyPdfText(text);
  assert.equal(data.trades[0].pnl, -25);
  assert.equal(data.notes[0].body, "My reflection");
  assert.deepEqual(data.notes[0].selectedTradeIds, [17]);
  assert.throws(
    () => parseLegacyPdfText(text.replace("1 trades", "2 trades")),
    /completely/,
  );
  assert.throws(() => parseLegacyPdfText("scanned report"), /recognized/);
});
