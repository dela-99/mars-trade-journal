import { test } from "node:test";
import assert from "node:assert/strict";
import {
  externalCsv,
  csvNotes,
  pdfNotes,
  externalDate,
  externalData,
} from "./external-import";
import { journalDays } from "./journal";
const options = {
  dateColumn: "Time",
  titleColumn: "",
  bodyColumn: "Message",
  dateOrder: "iso" as const,
  timeZone: "America/New_York",
};
test("MT5 CSV preserves original log day, millisecond timestamp, source/message and extra fields", () => {
  const data = externalCsv(
    'Time,Source,Message,Level\n2026.09.30 23:59:59.123,Trades,"order #12 executed, EURUSD",Info',
  );
  const notes = csvNotes(data, options);
  assert.equal(notes[0].date, "2026-09-30");
  assert.equal(notes[0].linkMode, "date");
  assert.equal(notes[0].timeZone, "America/New_York");
  assert.equal(
    notes[0].body,
    "2026-09-30 23:59:59.123 Trades order #12 executed, EURUSD\nLevel: Info",
  );
});
test("MT5 PDF rows and CSV rows produce matching identities, while event times stay distinct", () => {
  const csv = csvNotes(
    externalCsv(
      "Time\tSource\tMessage\n2026.09.30 09:30:00.123\tTrades\torder executed\n2026.09.30 09:30:00.124\tTrades\torder executed",
    ),
    options,
  );
  const pdf = pdfNotes(
    "Time Source Message\n2026.09.30 09:30:00.123 Trades order executed\n2026.09.30 09:30:00.124 Trades order executed",
    "America/New_York",
    "iso",
  );
  assert.equal(pdf.length, 2);
  assert.equal(pdf[0].body, csv[0].body);
  assert.equal(pdf[0].title, csv[0].title);
  assert.notEqual(pdf[0].body, pdf[1].body);
});
test("date order and missing log dates require an explicit choice; impossible dates are rejected", () => {
  assert.throws(() => externalDate("10/07/2026", "iso", "UTC"));
  assert.equal(externalDate("10/07/2026", "day-first", "UTC"), "2026-07-10");
  assert.equal(externalDate("10/07/2026", "month-first", "UTC"), "2026-10-07");
  assert.throws(() => externalDate("2026.02.30 09:00:00", "iso", "UTC"));
  const csv = externalCsv(
    "Time,Source,Message\n09:00:00.123,Network,Connected",
  );
  assert.throws(() => csvNotes(csv, options), /date is required/);
  assert.equal(
    csvNotes(csv, { ...options, fallbackDate: "2025-12-31" })[0].date,
    "2025-12-31",
  );
  const sections = pdfNotes(
    "2026-01-01\nFirst\n07/10/2026\nSecond",
    "UTC",
    "iso",
  );
  assert.equal(sections[1].date, "");
  assert.throws(() => externalData(sections, "UTC"), /date is required/);
});
test("timestamp offsets respect chosen timezone and date groups keep backdated notes without trades", () => {
  assert.equal(
    externalDate("2026-10-07T01:30:00Z", "iso", "America/New_York"),
    "2026-10-06",
  );
  const groups = journalDays(
    [{ id: 1, entryAt: "2026-10-07T01:30:00Z" }],
    [
      { id: 5, date: "2020-01-01" },
      { id: 6, date: "2026-10-06" },
    ],
    "America/New_York",
  );
  assert.deepEqual(groups, [
    { date: "2020-01-01", tradeIds: [], noteIds: [5] },
    { date: "2026-10-06", tradeIds: [1], noteIds: [6] },
  ]);
});

test("MT5 PDF cells split across text lines retain event identity", () => {
  const notes = pdfNotes(
    "Time\nSource\nMessage\n2020.09.30 09:30:00.123\nTrades\norder executed\n2020.09.30\n09:30:00.124\nTrades\norder executed",
    "UTC",
    "iso",
  );
  assert.equal(notes.length, 2);
  assert.equal(notes[0].title, "MetaTrader 5 log");
  assert.equal(notes[1].date, "2020-09-30");
  assert.equal(
    notes[0].body.replace(/\s+/g, " ").trim(),
    "2020-09-30 09:30:00.123 Trades order executed",
  );
  assert.equal(
    notes[1].body.replace(/\s+/g, " ").trim(),
    "2020-09-30 09:30:00.124 Trades order executed",
  );
});
