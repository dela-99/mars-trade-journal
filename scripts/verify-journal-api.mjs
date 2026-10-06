import assert from "node:assert/strict";
const base = process.env.JOURNAL_TEST_API;
if (!base)
  throw new Error(
    "Set JOURNAL_TEST_API to a disposable local API, e.g. http://localhost:3001/api",
  );
const tradeIds = [],
  noteIds = [];
async function request(path, method = "GET", body, status = 200) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}
try {
  const tradeInput = {
    symbol: "XAUUSD",
    asset: "Gold",
    side: "buy",
    lotSize: 0.1,
    entryAt: "2026-10-06T01:00:00Z",
    strategy: "Integration fixture",
    regime: "Trend",
    pnl: -10,
    notes: "Synthetic test",
  };
  for (let i = 0; i < 2; i++)
    tradeIds.push((await request("/trades", "POST", tradeInput, 201)).id);
  const note = {
    date: "2026-10-05",
    timeZone: "America/New_York",
    title: "Synthetic integration note",
    body: "A full reflection\n日本語",
    linkMode: "selected",
    selectedTradeIds: tradeIds,
    attachments: [
      {
        id: "56b777d6-ecdf-4ba3-bb07-59825375f1f9",
        name: "chart.png",
        caption: "Entry & exit",
        dataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
      },
    ],
  };
  const saved = await request("/journal-notes", "POST", note, 201);
  noteIds.push(saved.id);
  assert.equal(saved.attachments[0].dataUrl, note.attachments[0].dataUrl);
  assert.equal(
    (await request("/journal-notes")).find((n) => n.id === saved.id).body,
    note.body,
  );
  for (const invalid of [
    { date: "2026-02-30" },
    { date: "0000-01-01" },
    { selectedTradeIds: [2147483648] },
    { date: "2026-10-06" },
    { timeZone: "invalid" },
    { title: "   " },
    { selectedTradeIds: [2147483647] },
    { selectedTradeIds: [tradeIds[0], tradeIds[0]] },
    {
      attachments: [
        {
          ...note.attachments[0],
          dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
        },
      ],
    },
    { attachments: Array.from({ length: 6 }, () => note.attachments[0]) },
    {
      attachments: [
        { ...note.attachments[0], dataUrl: "data:image/png;base64,aGVsbG8=" },
      ],
    },
    { linkMode: "date" },
    { selectedTradeIds: [] },
  ])
    await request("/journal-notes", "POST", { ...note, ...invalid }, 400);
  await request(`/trades/${tradeIds[0]}`, "DELETE", undefined, 204);
  const updated = await request(`/journal-notes/${saved.id}`, "PUT", {
    ...note,
    body: "Retained after deletion",
  });
  assert.deepEqual(updated.selectedTradeIds, tradeIds);
  assert.equal(updated.attachments.length, 1);
  await request(`/trades/${tradeIds[1]}`, "PATCH", {
    ...tradeInput,
    entryAt: "2026-10-09T10:00:00Z",
  });
  await request(`/journal-notes/${saved.id}`, "PUT", {
    ...note,
    title: "Retained after date change",
  });
  const unlinked = await request(
    "/journal-notes",
    "POST",
    { ...note, date: "2026-09-01", linkMode: "date", selectedTradeIds: [] },
    201,
  );
  noteIds.push(unlinked.id);
  await request("/journal-notes/2147483647", "PUT", note, 404);
  console.log(
    "PASS: note CRUD, image persistence, timezone links, invalid payloads, missing/moved trades, and unlinked notes.",
  );
} finally {
  for (const id of noteIds)
    await fetch(`${base}/journal-notes/${id}`, { method: "DELETE" });
  for (const id of tradeIds)
    await fetch(`${base}/trades/${id}`, { method: "DELETE" });
}
