# M.A.R.S. Trade Journal

A responsive, manual trade journal for recording and reviewing trading decisions. This is a review-only tool: it has no broker connection and cannot place orders.

## Features

- Create, edit, search, filter, and delete journal entries
- Record XAUUSD, EURUSD, or USDJPY trades, with entry time, strategy, market regime, P&L, and notes
- Attach chart screenshots to entries; image files stay in this browser's IndexedDB and are not synced to other devices
- Export the complete journal to CSV
- Review cumulative P&L in chronological entry order

## Stack

- pnpm workspaces, TypeScript, React, and Vite
- Express API, PostgreSQL, Drizzle ORM, and Zod validation

## Run locally

Requirements: Node.js 24+, pnpm, and a PostgreSQL database.

1. Install dependencies: `pnpm install`
2. Set `DATABASE_URL` in your environment to the PostgreSQL connection string.
3. Start the API in one terminal: `pnpm --filter @workspace/api-server run dev`
4. Start the journal frontend in another terminal: `pnpm --filter @workspace/mars-trade-journal run dev`

Run `pnpm run typecheck` to typecheck the workspace. The trade API is described in `lib/api-spec/openapi.yaml`.
