// One-time operator action. Run with DATABASE_URL set, after creating the intended account.
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../server/db/package.json", import.meta.url),
);
const { Pool } = require("pg");
const email = process.argv[2]?.trim().toLowerCase();
if (!email || process.argv[3] !== "--confirm") {
  console.error(
    "Usage: node scripts/assign-legacy-journal.mjs owner@example.com --confirm",
  );
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "LOCK TABLE trades, journal_notes IN SHARE ROW EXCLUSIVE MODE",
  );
  const { rows } = await client.query(
    "SELECT id FROM journal_users WHERE lower(email)=$1",
    [email],
  );
  if (rows.length !== 1) throw new Error("Create the intended account first.");
  const trades = await client.query(
    "UPDATE trades SET user_id=$1 WHERE user_id IS NULL",
    [rows[0].id],
  );
  const notes = await client.query(
    "UPDATE journal_notes SET user_id=$1 WHERE user_id IS NULL",
    [rows[0].id],
  );
  await client.query("COMMIT");
  console.log(
    `Assigned ${trades.rowCount} legacy trades and ${notes.rowCount} legacy notes to the chosen account.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
