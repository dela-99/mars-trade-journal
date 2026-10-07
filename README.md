# M.A.R.S. Trade Journal

A responsive, manual trade journal for recording and reviewing trading decisions. This is a review-only tool: it has no broker connection and cannot place orders.

## Features

- Create, edit, search, filter, and delete journal entries
- Record XAUUSD, EURUSD, or USDJPY trades, with entry time, strategy, market regime, P&L, and notes
- Email/password accounts with private journals accessible from any device
- Preview and restore CSV, CSV ZIP, JSON, and recoverable PDF backups without duplicate imports
- Write long dated notes with up to five screenshots and captions, saved in PostgreSQL
- Automatically link notes to all trades on that date, or select specific trades
- Export the complete journal to JSON with images, CSV with image files in a ZIP, or a recoverable PDF report
- Review cumulative P&L in chronological entry order

## Stack

- pnpm workspaces, TypeScript, React, and Vite
- Express API, PostgreSQL, Drizzle ORM, and Zod validation

## Run locally

Requirements: Node.js 24+, pnpm, and a PostgreSQL database.

1. Install dependencies: `pnpm install`
2. Configure the server environment using `.env.example`: `DATABASE_URL`, a random `BETTER_AUTH_SECRET` (at least 32 characters), and `BETTER_AUTH_URL` (the public application origin, e.g. `http://localhost:3000`). Never commit actual credentials.
3. Apply the schema to a new local database: `pnpm --filter @workspace/db push`. For an existing deployment, apply `server/db/migrations/0001_journal_notes.sql` and `server/db/migrations/0002_accounts_and_imports.sql` to the same database before starting the updated API. See the explicit legacy ownership step below. Existing trades are preserved.
4. Start the API in one terminal: `PORT=3001 pnpm --filter @workspace/api-server run dev`
5. Start the frontend in another terminal: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/mars-trade-journal run dev`. Vite proxies `/api` to port 3001; override `API_PROXY_TARGET` if needed. In production, route `/api` to the API server.

Run `pnpm run typecheck` to typecheck the workspace. The trade API is described in `server/api-spec/openapi.yaml`.


## Notes and trade links

Use **Write note** for a daily reflection, or the note action on a trade to select that trade directly. Choose the trading date, write a title and note, and add PNG, JPEG, WebP or GIF screenshots (5 MB each, five per note). Captions explain what to look for in each chart. Notes and new screenshots are saved together on the server.

A note stores your browser's timezone when created. Its journal date matches the trade's **entry date in that timezone**, not the screenshot upload date. Automatic linking includes every trade on that date, including trades added later. Choose specific trades when multiple trades on a day need different notes. Notes without trades remain available. Deleting or changing the date of a selected trade keeps the original selection and shows a warning; it never silently selects another trade. Changing a note's date resets its selection to automatic matching.

Earlier screenshots remain in browser IndexedDB; new screenshot actions save a server-backed note. Export from that browser to include those images. They have not been migrated automatically and are not available on other devices.

## Exports for AI review

All exports include the whole journal regardless of search or view filters. Fetch or storage failures stop export instead of producing a partial journal.

- **JSON + images:** versioned structured data with trades, notes, resolved trade IDs, missing/changed links, captions, and image data URLs. An AI/tool must support decoding image data or receiving images; base64 text alone is not image analysis.
- **CSV + images (.zip):** `journal.csv` contains typed trade, note, and attachment rows with stable IDs and image paths. `images/` holds original files; `manifest.json` preserves exact text and link metadata. Give the AI the CSV and image files together. Spreadsheet formula protection prefixes risky text with an apostrophe; numeric P&L remains numeric.
- **PDF backup:** downloads readable pages with trade IDs, dated notes and screenshots, plus an embedded `mars-journal.json` containing the exact recovery data. Import the original downloaded PDF to restore images and links; reprinting or editing it can discard the attachment. The standard PDF font may substitute unsupported characters on visible pages; the embedded backup preserves original Unicode text exactly.

The app exports evidence and captions; it does not perform OCR or send your journal to an AI service.

## Verification

- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server run test:journal` — focused date, link, image-validation and export tests
- `node scripts/verify-account-import.mjs` — run with `DATABASE_URL` and `JOURNAL_TEST_ORIGIN` against a disposable local API/database; creates authenticated synthetic fixtures and cleans them up
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/mars-trade-journal run build`
- `pnpm --filter @workspace/api-server run build`

## Repository layout

```text
frontend/                 React/Vite app and public/PWA assets
  api-client/             Browser API client
  mockup-sandbox/         Optional local UI preview tool
server/                   Express backend
  db/                     PostgreSQL schema and migrations
  api-zod/                API validation
  api-spec/               OpenAPI contract and code generation
scripts/                  Workspace verification and operator tools
vercel.json               Frontend build and /api forwarding to Render
render.yaml               Render backend Web Service definition
```

## Deploy: Vercel frontend + Render backend

Deploy the same repository to two hosts. Both builds use the **repository root** for the pnpm workspace/lockfile; application source is grouped into `frontend/` and `server/`.

1. Connect a hosted PostgreSQL database and provision its schema. Existing data needs the migration/ownership steps below. Convex is not used by this PostgreSQL adapter.
2. Create the Render backend using `render.yaml` or the exact settings in [server/README.md](server/README.md). Set `DATABASE_URL`, a stable `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` to the final Vercel/custom frontend HTTPS origin. Keep Render Root Directory blank. Render provides `PORT`; the app listens on `0.0.0.0`.
3. Replace `https://replace-with-your-render-service.onrender.com` in `vercel.json` with the actual Render URL. This is a deployment placeholder, not a working backend. Preserve `/api/:path*` in the destination.
4. Import the repository into Vercel with **Root Directory `./`** and **Framework Preset Vite**. The root config builds only the frontend and publishes `frontend/dist/public`. See [frontend/README.md](frontend/README.md). Do not select Services or import individual workspace packages as projects.
5. Verify the frontend sign-up/login, record a trade, reload, and sign in on a second device. `/api/healthz` on the frontend URL should reach Render. Keep the canonical frontend URL identical to `BETTER_AUTH_URL`; update it when assigning a custom domain.

The frontend calls same-origin `/api`. Vercel's external rewrite proxies the request to Render, which runs Express and accesses PostgreSQL. This keeps session cookies first-party and preserves the existing same-origin write checks. There are no Vercel Functions or service bindings in this configuration; database/auth secrets belong only on Render. The mockup sandbox is retained for local development and not deployed.

External rewrite proxies have their own platform limits. Moving Express to Render removes the previous Vercel **Function** request-body constraint from the backend; it does not guarantee unlimited transfers through Vercel's proxy. Large screenshots/imports must be checked against the deployed hosts' proxy/body/time limits. Direct object storage remains an option for larger journals. Local tests do not prove hosted transfer limits.

References: [Vercel external rewrites](https://vercel.com/docs/rewrites), [Render Express deployment](https://render.com/docs/deploy-node-express-app), [Render Blueprint](https://render.com/docs/blueprint-spec).

## Accounts, sync and restoration

Sign up with your email and a password of at least 12 characters. Sign in on another device using the same account to access the same PostgreSQL journal. Session cookies are HttpOnly and use HTTPS in production. All trade, note, summary and import routes require a session and enforce account ownership. Data refreshes every 15 seconds and when returning to the app; Refresh updates it immediately. The app requires an internet connection and does not queue offline edits. Simultaneous manual edits currently use the last successful save.

This implementation uses **Better Auth with the existing PostgreSQL database**; Convex is not required. Production needs a durable hosted PostgreSQL connection and the server environment variables in `.env.example`. Keep the auth secret stable across restarts. Email delivery is not configured: email verification and self-service password-reset emails are not available yet. Save your password and keep recovery exports.

### Upgrade an existing installation

1. Back up the database and export older browser screenshots before changing deployments.
2. Apply `server/db/migrations/0001_journal_notes.sql` if needed, then `server/db/migrations/0002_accounts_and_imports.sql` to the existing PostgreSQL database. For a fresh development database, `pnpm --filter @workspace/db push` creates the current schema.
3. Configure the auth environment and create your intended account through the app.
4. Existing trades and notes are preserved with an unassigned owner. They are deliberately hidden from new accounts. The database operator can explicitly assign **all unowned legacy rows** to the original journal owner's account:

   ```bash
   # DATABASE_URL must point to the intended database. Check the account first.
   node scripts/assign-legacy-journal.mjs owner@example.com --confirm
   ```

   Never expose this operator command as a public signup action. It does not move records already assigned to another account. Older browser screenshots are included in exports only when their trade IDs belong to the signed-in user's current journal; they are not automatically uploaded. Import a complete backup to convert supported legacy images into server-backed notes.

### Import a backup

Choose **Pick up where you left off → Choose backup**. Inspect the counts, sample entries and any warnings, then confirm. The server validates the complete batch before saving in one transaction. Trade IDs are remapped so selected notes keep their intended links. Missing selected trades remain visibly missing; they never become links to unrelated rows. Duplicate imports and concurrent retries are safe. Imports keep existing edits and deleted records; they do not overwrite them. A later full backup can add missing screenshots to a note first restored from CSV, without replacing its text or existing images.

- **CSV:** supports current typed journal rows and the original `Symbol, Asset, Side, Lot size, Entry date, Strategy, Market regime, P&L, Notes` export. Multiline quoted text and formula-protected cells are handled. CSV has no image bytes; use its original ZIP to restore screenshots.
- **CSV ZIP / JSON:** restores structured records, captions, original image bytes and links. Missing image files reject the backup; nothing is silently dropped. Supported legacy screenshots become dated notes. Orphaned/unsupported legacy images require separate recovery.
- **New PDF backup:** reads the embedded JSON for exact restoration, including screenshots.
- **Older printed M.A.R.S. PDF:** offers text recovery only when every declared trade and note can be recognized. It cannot restore image bytes, original audit timestamps, or exact whitespace. Review the preview. Scanned PDFs and unrelated PDF layouts need conversion to the supported CSV columns; the app does not guess their trade values.

Import files are limited to 40 MB, expanded ZIP contents to 100 MB, and a batch to 10,000 trades / 1,000 notes. Existing per-note image limits still apply. Hosted transfers also depend on the Vercel proxy and Render limits described above; validate larger backups on the deployed hosts.

### Account/import verification

`pnpm --filter @workspace/api-server run test:journal` covers export/import format roundtrips and core date/image rules. With the app and disposable PostgreSQL running and `DATABASE_URL` set, run:

```bash
JOURNAL_TEST_ORIGIN=http://localhost:3000 node scripts/verify-account-import.mjs
```

It creates and removes synthetic accounts, checks signup/login/logout, two-device access, account isolation, same-origin writes, import validation, link remapping and concurrent duplicate protection. The older `verify-journal-api.mjs` now requires a session cookie and origin (see that script's environment variables).

## MetaTrader 5 logs and external notes

Use **Import source → MetaTrader 5 / another app — CSV or PDF** and choose your file. These imports become notes, preserving the logs as evidence; they do not create trade executions from log messages.

- MT5 CSV/TSV columns `Time`, `Source`, and `Message` are recognized. UTF-8 and BOM-marked UTF-16 are supported. `YYYY.MM.DD HH:mm:ss.fff` timestamps retain their date, source and message. Additional CSV columns are preserved in the note.
- Set **Original computer timezone** to the timezone of the computer that produced the logs. MetaQuotes documents Journal/Experts timestamps as computer-local, rather than necessarily broker/server time: [MT5 Platform Logs](https://www.metatrader5.com/en/terminal/help/start_advanced/journal).
- If a CSV has times without dates, supply the original date explicitly. Ambiguous day/month dates need a date-order choice. Missing or invalid dates prevent import; the upload date is never substituted.
- Text PDFs recognize dated MT5 rows and explicit date headings. Other extracted text stays editable. Review the full text, supply missing dates, and exclude headers or unwanted sections before checking duplicates. Scanned PDFs need OCR or a CSV export first. PDF text extraction does not recover screenshots.
- Confirm the preview to save. Date-linked notes include existing trades on that day and trades recorded later. Multiple trades on a day remain visible; log messages are not silently assigned to one execution.

Duplicate checking compares normalized full entries, ignoring extra whitespace and Unicode encoding differences. It checks both the selected file and records already in the signed-in account, including manual entries. Notes with different dates, timezones, timestamps, text, selected trade links or images stay distinct. The same MT5 row imported from both CSV and PDF is skipped when these fields match. Similar wording alone is not enough to delete data. Existing duplicates are not automatically deleted. For trading backups with legitimately identical executions, select **Keep separate trade executions with identical values** before choosing the file.

## Grouped dates and exports

**By date** is the default journal view. It combines trades and notes from all sources, including old imports and dates without trades. Trade grouping defaults to UTC consistently across devices; choose another displayed timezone when reviewing. Notes keep their original calendar date and saved timezone. Date-based trade links always use each note's timezone, so a link can cross a UTC date boundary.

Exports include the whole journal: JSON adds ascending `dateGroups` with trade/note IDs and explicit grouping semantics, CSV rows are ordered by their journal date, and PDF pages group trades and notes under chronological date headings. Recoverable PDF attachments and screenshot links remain intact.

## Install on a phone or desktop

M.A.R.S. is an installable progressive web app. Deploy to **HTTPS** (localhost is permitted for development). Use **Install app** on the sign-in page or account bar when your browser supports the installation prompt. On iPhone/iPad, open the site in Safari and choose **Share → Add to Home Screen**. Android and desktop browsers also provide an Install/Add to Home screen menu. This does not require an app-store package.

The manifest includes standalone display, 192/512px icons, a maskable icon and an Apple touch icon. Pinch zoom stays enabled; mobile forms use readable input sizes and the installed layout respects safe-area insets. The service worker caches only the public offline notice. It never stores journal/API responses or screenshots for offline use, and it does not queue edits. An internet connection is required to sign in and sync.
