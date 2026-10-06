# M.A.R.S. Trade Journal

A responsive, manual trade journal for recording and reviewing trading decisions. This is a review-only tool: it has no broker connection and cannot place orders.

## Features

- Create, edit, search, filter, and delete journal entries
- Record XAUUSD, EURUSD, or USDJPY trades, with entry time, strategy, market regime, P&L, and notes
- Legacy trade screenshot panel: attach chart screenshots to entries; image files stay in this browser's IndexedDB and are not synced to other devices
- Write long dated notes with up to five screenshots and captions, saved in PostgreSQL
- Automatically link notes to all trades on that date, or select specific trades
- Export the complete journal to JSON with images, CSV with image files in a ZIP, or a printable PDF report
- Review cumulative P&L in chronological entry order

## Stack

- pnpm workspaces, TypeScript, React, and Vite
- Express API, PostgreSQL, Drizzle ORM, and Zod validation

## Run locally

Requirements: Node.js 24+, pnpm, and a PostgreSQL database.

1. Install dependencies: `pnpm install`
2. Set `DATABASE_URL` in your environment to the PostgreSQL connection string.
3. Apply the schema to a new local database: `pnpm --filter @workspace/db push`. For an existing deployment, apply the additive migration `lib/db/migrations/0001_journal_notes.sql` to the same database before starting the updated API. Existing trades are preserved.
4. Start the API in one terminal: `PORT=3001 pnpm --filter @workspace/api-server run dev`
5. Start the frontend in another terminal: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/mars-trade-journal run dev`. Vite proxies `/api` to port 3001; override `API_PROXY_TARGET` if needed. In production, route `/api` to the API server.

Run `pnpm run typecheck` to typecheck the workspace. The trade API is described in `lib/api-spec/openapi.yaml`.


## Notes and trade links

Use **Write note** for a daily reflection, or the note action on a trade to select that trade directly. Choose the trading date, write a title and note, and add PNG, JPEG, WebP or GIF screenshots (5 MB each, five per note). Captions explain what to look for in each chart. Notes and new screenshots are saved together on the server.

A note stores your browser's timezone when created. Its journal date matches the trade's **entry date in that timezone**, not the screenshot upload date. Automatic linking includes every trade on that date, including trades added later. Choose specific trades when multiple trades on a day need different notes. Notes without trades remain available. Deleting or changing the date of a selected trade keeps the original selection and shows a warning; it never silently selects another trade. Changing a note's date resets its selection to automatic matching.

The earlier trade screenshot panel still uses browser IndexedDB. Export from that browser to include those images. They have not been migrated automatically and are not available on other devices.

## Exports for AI review

All exports include the whole journal regardless of search or view filters. Fetch or storage failures stop export instead of producing a partial journal.

- **JSON + images:** versioned structured data with trades, notes, resolved trade IDs, missing/changed links, captions, and image data URLs. An AI/tool must support decoding image data or receiving images; base64 text alone is not image analysis.
- **CSV + images (.zip):** `journal.csv` contains typed trade, note, and attachment rows with stable IDs and image paths. `images/` holds original files; `manifest.json` preserves exact text and link metadata. Give the AI the CSV and image files together. Spreadsheet formula protection prefixes risky text with an apostrophe; numeric P&L remains numeric.
- **PDF report:** opens a printable report with selectable text, trade IDs, note dates/timezones, and screenshots beside their notes. Click **Print / Save as PDF** in the report, then choose **Save as PDF** in the browser print dialog. Allow popups for this action. Unsupported legacy image formats remain available in JSON/CSV.

The app exports evidence and captions; it does not perform OCR or send your journal to an AI service.

## Verification

- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server run test:journal` — focused date, link, image-validation and export tests
- `JOURNAL_TEST_API=http://localhost:3001/api node scripts/verify-journal-api.mjs` — run against a disposable local API/database; creates synthetic fixtures and cleans them up
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/mars-trade-journal run build`
- `pnpm --filter @workspace/api-server run build`
