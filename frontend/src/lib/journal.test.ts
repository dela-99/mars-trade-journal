import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { journalDate, noteLinks } from "./journal";
import {
  buildJournalExport,
  csvBundle,
  csvCell,
  journalCsv,
  printableJournal,
} from "./journal-export";
import type { JournalNote, Trade } from "@workspace/api-client-react";

const trade = (id: number, entryAt = "2026-10-06T01:00:00Z"): Trade => ({
  id,
  entryAt,
  symbol: "XAUUSD",
  asset: "Gold",
  side: "buy",
  lotSize: 0.1,
  pnl: -10,
  strategy: "Breakout",
  regime: "Trend",
  notes: 'Risk, review\n"quoted"',
  createdAt: entryAt,
  updatedAt: entryAt,
});
const note: JournalNote = {
  id: 7,
  date: "2026-10-05",
  timeZone: "America/New_York",
  title: '=HYPERLINK("bad")',
  body: "<script>alert(1)</script>\nReflection 日本語",
  linkMode: "date",
  selectedTradeIds: [],
  attachments: [
    {
      id: "56b777d6-ecdf-4ba3-bb07-59825375f1f9",
      name: "../../chart.png",
      caption: "Entry & exit",
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
    },
  ],
  createdAt: "2026-10-10T00:00:00Z",
  updatedAt: "2026-10-10T00:00:00Z",
};

test("calendar links use saved timezone, match every same-day trade, and include later additions", () => {
  assert.equal(
    journalDate("2026-10-06T01:00:00Z", "America/New_York"),
    "2026-10-05",
  );
  assert.equal(
    journalDate("2026-03-08T07:00:00Z", "America/New_York"),
    "2026-03-08",
  );
  assert.deepEqual(
    noteLinks(note, [
      trade(1),
      trade(2),
      trade(3, "2026-10-06T15:00:00Z"),
    ]).linked.map((t) => t.id),
    [1, 2],
  );
  assert.equal(noteLinks(note, []).linked.length, 0);
  assert.equal(noteLinks(note, [trade(4)]).linked[0].id, 4);
});
test("selected links never silently reassign after deletion or a date edit", () => {
  const links = noteLinks(
    { ...note, linkMode: "selected", selectedTradeIds: [1, 2] },
    [trade(1, "2026-10-08T10:00:00Z"), trade(3)],
  );
  assert.deepEqual(
    links.linked.map((t) => t.id),
    [1],
  );
  assert.deepEqual(links.missingTradeIds, [2]);
  assert.deepEqual(links.changedDateTradeIds, [1]);
});
test("CSV preserves multiline text and numeric losses, but neutralizes formula text", () => {
  assert.equal(csvCell(-10), '"-10"');
  assert.equal(csvCell(" \t=1+1"), '"\' \t=1+1"');
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
});
test("exports preserve stable IDs, notes without trades, image bytes, paths, and text", async () => {
  const data = await buildJournalExport(
    [trade(2), trade(1)],
    [note, { ...note, id: 8, date: "2026-09-01", attachments: [] }],
    [],
  );
  assert.deepEqual(
    data.trades.map((t) => t.id),
    [1, 2],
  );
  assert.deepEqual(data.notes.find((n) => n.id === 7)?.linkedTradeIds, [2, 1]);
  assert.deepEqual(data.notes.find((n) => n.id === 8)?.linkedTradeIds, []);
  assert.equal(data.attachments[0].noteId, 7);
  assert.equal(data.attachments[0].path, "images/0001.png");
  assert.equal(
    JSON.parse(JSON.stringify(data)).attachments[0].dataUrl,
    note.attachments[0].dataUrl,
  );
  const archive = unzipSync(await csvBundle(data));
  assert.equal(
    Buffer.from(archive["journal.csv"]).toString("utf8"),
    journalCsv(data),
  );
  assert.equal(
    Buffer.from(archive["images/0001.png"]).toString("base64"),
    note.attachments[0].dataUrl.split(",")[1],
  );
  const manifest = JSON.parse(strFromU8(archive["manifest.json"]));
  assert.equal(
    manifest.notes.find((n: JournalNote) => n.id === 7).body,
    note.body,
  );
  assert.equal(manifest.attachments[0].dataUrl, undefined);
  const html = printableJournal(data);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("日本語"));
  assert.ok(html.includes(note.attachments[0].dataUrl));
});
