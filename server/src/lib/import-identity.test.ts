import { test } from "node:test";
import assert from "node:assert/strict";
import { noteIdentity, tradeIdentity } from "./import-identity";
const note = {
  date: "2026-09-30",
  timeZone: "UTC",
  title: "MetaTrader 5 log",
  body: "2026-09-30 09:30:00.123 Trades order executed",
  linkMode: "date",
  selectedTradeIds: [],
  attachments: [],
};
test("note duplicates ignore spacing but retain dates, timezone, case, timestamps, images and selected links", () => {
  assert.equal(
    noteIdentity(note),
    noteIdentity({
      ...note,
      body: "  2026-09-30   09:30:00.123\nTrades order executed ",
    }),
  );
  for (const other of [
    { ...note, date: "2026-10-01" },
    { ...note, timeZone: "America/New_York" },
    { ...note, body: note.body.replace(".123", ".124") },
    { ...note, body: note.body.toUpperCase() },
    { ...note, linkMode: "selected", selectedTradeIds: [1] },
  ])
    assert.notEqual(noteIdentity(note), noteIdentity(other));
});
test("trade duplicates require identical execution details, not just a matching date and symbol", () => {
  const trade = {
    symbol: "EURUSD",
    asset: "forex",
    side: "buy",
    lotSize: 1,
    entryAt: "2026-10-07T10:00:00Z",
    strategy: "S",
    regime: "Trend",
    pnl: 5,
    notes: "",
  };
  assert.equal(
    tradeIdentity(trade),
    tradeIdentity({
      ...trade,
      entryAt: "2026-10-07T11:00:00+01:00",
      lotSize: "1.00",
    }),
  );
  assert.notEqual(
    tradeIdentity(trade),
    tradeIdentity({ ...trade, lotSize: 2 }),
  );
});
