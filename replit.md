# M.A.R.S. Trade Journal

A responsive manual trade journal for recording, reviewing, and learning from trading decisions without broker execution.

## Run & Operate

- `PORT=3001 pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required server env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (public frontend origin)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod 3, `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM backend bundle), Vite (frontend)

## Where things live

- `frontend/` — React/Vite dashboard and trade-entry UI
- `server/src/routes/trades.ts` — journal CRUD and summary endpoints
- `server/api-spec/openapi.yaml` — source-of-truth API contract
- `server/db/src/schema/trades.ts` — source-of-truth PostgreSQL trade schema
- `frontend/src/index.css` — dashboard theme and visual tokens

## Architecture decisions

- Trade records are persisted in PostgreSQL so entries survive reloads and are ready for future automated ingestion.
- Accounts, journal notes and screenshot evidence are stored in PostgreSQL. Legacy browser-local screenshots remain exportable; account ownership protects server records.
- Deployment: Vercel serves the frontend and proxies `/api` to the Render backend. See the root README and per-folder deployment guides.
- The API is contract-first through OpenAPI, with generated Zod validation and React Query hooks.
- The product intentionally exposes journal CRUD only; it has no broker connection or trade execution capability.
- The first version calculates lightweight review summaries from recorded entries and leaves deeper analytics for later.

## Product

Users can record a manual trade with symbol, asset, direction, lot size, entry timestamp, strategy, market regime, P&L, and notes. They can search, filter, review, edit, delete, and attach local chart/setup screenshots to entries while seeing aggregate counts and P&L state-aware styling.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
