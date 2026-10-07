import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../package.json", import.meta.url),
);
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.JOURNAL_TEST_ORIGIN ?? "http://localhost:3000";
const suffix = randomUUID();
const emails = [
  `test-a-${suffix}@example.test`,
  `test-b-${suffix}@example.test`,
];
const password = randomUUID() + "-journal-test";
const users = [];
async function request(
  path,
  { cookie, method = "GET", body, origin = base } = {},
) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    status: response.status,
    data,
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
    headers: response.headers,
  };
}
const trade = {
  symbol: "SYNC",
  asset: "forex",
  side: "buy",
  lotSize: 0.1,
  entryAt: "2026-10-07T12:00:00.000Z",
  strategy: "breakout",
  regime: "trend",
  pnl: 25,
  notes: "Quotes, commas\nand 日本語",
};
const image = {
  id: randomUUID(),
  name: "chart.png",
  caption: "A restored chart",
  dataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
};
const note = {
  date: "2026-10-07",
  timeZone: "UTC",
  title: "Review",
  body: "Exact reflection",
  linkMode: "selected",
  selectedTradeIds: [17],
  attachments: [image],
};
try {
  assert.equal((await request("/trades")).status, 401);
  assert.equal((await request("/journal-notes")).status, 401);
  assert.equal(
    (
      await request("/import/commit", {
        method: "POST",
        body: { trades: [trade], notes: [] },
      })
    ).status,
    401,
  );
  for (const email of emails) {
    const r = await request("/auth/sign-up/email", {
      method: "POST",
      body: { name: "Import verification", email, password },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.cookie);
    assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
    users.push(r.cookie);
  }
  const [a, b] = users;
  const originalChecks = spawnSync(
    process.execPath,
    [new URL("./verify-journal-api.mjs", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        JOURNAL_TEST_API: base + "/api",
        JOURNAL_TEST_ORIGIN: base,
        JOURNAL_TEST_COOKIE: a,
      },
      stdio: "inherit",
    },
  );
  assert.equal(originalChecks.status, 0);

  assert.equal(
    (
      await request("/auth/sign-in/email", {
        method: "POST",
        body: { email: emails[0], password: "wrong-password-for-test" },
      })
    ).status,
    401,
  );
  const device2 = await request("/auth/sign-in/email", {
    method: "POST",
    body: { email: emails[0], password },
  });
  assert.equal(device2.status, 200);
  assert.equal(
    (
      await request("/trades", {
        cookie: a,
        method: "POST",
        body: trade,
        origin: "https://other.example",
      })
    ).status,
    403,
  );
  const existing = await request("/trades", {
    cookie: b,
    method: "POST",
    body: { ...trade, symbol: "OTHER" },
  });
  assert.equal(existing.status, 201);
  const backup = {
    trades: [
      {
        ...trade,
        id: 17,
        createdAt: "2026-10-07T12:00:00.000Z",
        updatedAt: "2026-10-07T12:00:00.000Z",
      },
    ],
    notes: [{ ...note, id: 9 }],
  };
  const preview = await request("/import/preview", {
    cookie: a,
    method: "POST",
    body: backup,
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.tradesAdded, 1);
  assert.equal(preview.data.notesAdded, 1);
  assert.equal((await request("/trades", { cookie: a })).data.length, 0);
  const impossibleTrade = {
    ...backup,
    trades: [{ ...backup.trades[0], entryAt: "2026-02-30T12:00:00.000Z" }],
  };
  assert.equal(
    (
      await request("/import/commit", {
        cookie: a,
        method: "POST",
        body: impossibleTrade,
      })
    ).status,
    400,
  );
  const invalid = {
    ...backup,
    notes: [{ ...note, id: 9, date: "2026-02-30" }],
  };
  assert.equal(
    (
      await request("/import/commit", {
        cookie: a,
        method: "POST",
        body: invalid,
      })
    ).status,
    400,
  );
  assert.equal((await request("/trades", { cookie: a })).data.length, 0);
  const imported = await request("/import/commit", {
    cookie: a,
    method: "POST",
    body: backup,
  });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  assert.equal(imported.data.images, 1);
  const trades = (await request("/trades", { cookie: device2.cookie })).data;
  const notes = (await request("/journal-notes", { cookie: device2.cookie }))
    .data;
  assert.equal(trades.length, 1);
  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0].selectedTradeIds, [trades[0].id]);
  assert.equal(notes[0].attachments[0].dataUrl, image.dataUrl);
  assert.equal(trades[0].notes, trade.notes);
  const repeated = await request("/import/commit", {
    cookie: a,
    method: "POST",
    body: backup,
  });
  assert.equal(repeated.data.tradesAdded, 0);
  assert.equal(repeated.data.notesAdded, 0);
  assert.equal(
    (await request("/trades/summary", { cookie: b })).data.totalTrades,
    1,
  );
  for (const path of [
    `/trades/${trades[0].id}`,
    `/journal-notes/${notes[0].id}`,
  ])
    assert.equal(
      (await request(path, { cookie: b, method: "DELETE" })).status,
      404,
    );
  assert.equal(
    (
      await request(`/trades/${trades[0].id}`, {
        cookie: b,
        method: "PATCH",
        body: trade,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/journal-notes", {
        cookie: b,
        method: "POST",
        body: { ...note, selectedTradeIds: [trades[0].id] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/journal-notes/${notes[0].id}`, {
        cookie: b,
        method: "PUT",
        body: { ...note, selectedTradeIds: [existing.data.id] },
      })
    ).status,
    404,
  );
  const withoutImages = {
    trades: [],
    notes: [
      {
        ...note,
        id: 50,
        title: "CSV then full backup",
        selectedTradeIds: [17],
        attachments: [],
        createdAt: "2026-10-07T13:00:00.000Z",
      },
    ],
  };
  assert.equal(
    (
      await request("/import/commit", {
        cookie: a,
        method: "POST",
        body: withoutImages,
      })
    ).status,
    200,
  );
  const completeImages = {
    ...withoutImages,
    notes: [{ ...withoutImages.notes[0], attachments: [image] }],
  };
  const enriched = await request("/import/commit", {
    cookie: a,
    method: "POST",
    body: completeImages,
  });
  assert.equal(enriched.status, 200);
  assert.equal(enriched.data.images, 1);
  assert.equal(enriched.data.notesAdded, 0);
  assert.equal(
    (await request("/journal-notes", { cookie: a })).data.find(
      (n) => n.title === "CSV then full backup",
    ).attachments.length,
    1,
  );
  const next = { trades: [{ ...trade, symbol: "NEXT", id: 18 }], notes: [] };
  const parallel = await Promise.all([
    request("/import/commit", { cookie: a, method: "POST", body: next }),
    request("/import/commit", { cookie: a, method: "POST", body: next }),
  ]);
  assert.equal(
    parallel.reduce((sum, r) => sum + r.data.tradesAdded, 0),
    1,
  );
  assert.equal((await request("/trades", { cookie: a })).data.length, 2);
  const missing = await request("/import/commit", {
    cookie: a,
    method: "POST",
    body: {
      trades: [],
      notes: [{ ...note, id: 44, selectedTradeIds: [existing.data.id] }],
    },
  });
  assert.equal(missing.status, 200);
  assert.equal(missing.data.missingLinks, 1);
  const missingNote = (
    await request("/journal-notes", { cookie: a })
  ).data.find(
    (n) => n.id !== notes[0].id && n.title !== "CSV then full backup",
  );
  assert.notEqual(missingNote.selectedTradeIds[0], existing.data.id);
  assert.equal(
    (await request("/auth/sign-out", { cookie: a, method: "POST", body: {} }))
      .status,
    200,
  );
  assert.equal((await request("/trades", { cookie: a })).status, 401);
  assert.equal(
    (await request("/trades", { cookie: device2.cookie })).status,
    200,
  );
  const logNote = {
    id: 301,
    date: "2020-09-30",
    timeZone: "UTC",
    title: "MetaTrader 5 log",
    body: "2020-09-30 09:30:00.123 Trades order executed",
    linkMode: "date",
    selectedTradeIds: [],
    attachments: [],
  };
  const external = {
    trades: [],
    notes: [
      logNote,
      {
        ...logNote,
        id: 302,
        body: "  2020-09-30 09:30:00.123   Trades order executed  ",
      },
      { ...logNote, id: 303, body: logNote.body.replace(".123", ".124") },
    ],
  };
  const ep = await request("/import/preview", {
    cookie: device2.cookie,
    method: "POST",
    body: external,
  });
  assert.equal(ep.data.notesAdded, 2);
  assert.equal(ep.data.notesSkipped, 1);
  const ec = await request("/import/commit", {
    cookie: device2.cookie,
    method: "POST",
    body: external,
  });
  assert.deepEqual(ec.data, ep.data);
  const reordered = {
    trades: [],
    notes: [
      { ...external.notes[2], id: 400 },
      { ...external.notes[0], id: 401 },
    ],
  };
  assert.equal(
    (
      await request("/import/commit", {
        cookie: device2.cookie,
        method: "POST",
        body: reordered,
      })
    ).data.notesAdded,
    0,
  );
  const savedLogs = (
    await request("/journal-notes", { cookie: device2.cookie })
  ).data.filter((n) => n.date === "2020-09-30");
  assert.equal(savedLogs.length, 2);
  assert.ok(savedLogs.every((n) => n.linkMode === "date"));
  const sameTrades = {
    trades: [
      { ...trade, id: 800, symbol: "DUPE" },
      { ...trade, id: 801, symbol: "DUPE" },
    ],
    notes: [],
  };
  const dedupTrades = await request("/import/commit", {
    cookie: device2.cookie,
    method: "POST",
    body: sameTrades,
  });
  assert.equal(dedupTrades.data.tradesAdded, 1);
  assert.equal(dedupTrades.data.tradesSkipped, 1);
  const separateTrades = {
    trades: [
      { ...trade, id: 810, symbol: "SEPARATE" },
      { ...trade, id: 811, symbol: "SEPARATE" },
    ],
    notes: [],
    preserveIdenticalTrades: true,
  };
  assert.equal(
    (
      await request("/import/commit", {
        cookie: device2.cookie,
        method: "POST",
        body: separateTrades,
      })
    ).data.tradesAdded,
    2,
  );
  console.log(
    "PASS: signup/login/logout, second-device data, protected CRUD, isolation, CSRF, import preview, atomic validation, links/images, duplicate and concurrent imports.",
  );
} finally {
  await pool.query("DELETE FROM journal_users WHERE email = ANY($1::text[])", [
    emails,
  ]);
  await pool.end();
}
