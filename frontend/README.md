# Frontend — Vercel

This folder contains the React/Vite app (`src`, `public`), its browser API client (`api-client`), and the optional UI development tool (`mockup-sandbox`). The mockup tool is not deployed.

Import this repository into Vercel with **Root Directory `./`** and **Framework Preset Vite**. The root `vercel.json` installs the pnpm workspace, runs `pnpm run build:frontend`, and publishes only `frontend/dist/public`. Keep the root directory at the repository root: this app uses the shared pnpm lockfile and TypeScript configuration.

Before deploying, replace `https://replace-with-your-render-service.onrender.com` in the root `vercel.json` with the backend URL from Render. Keep `/api/:path*` on the destination. Requests for `/api` are forwarded to Render. The journal currently has one page at `/`; no catch-all rewrite is needed. If new client routes are added, add targeted SPA fallbacks that preserve static assets and Vite development modules. Static assets and the PWA manifest/worker are served by Vercel.

The browser always calls `/api` on its own origin. Vercel forwards those requests to Render, which runs the entire backend. This preserves first-party login cookies; no cross-site cookie settings, `VITE_API_URL`, server bindings, or browser credentials are needed. Set Render's `BETTER_AUTH_URL` to the exact public **frontend** HTTPS origin (without `/api`). Never put database/auth secrets in the frontend or `VITE_*` variables.

For local development, run the backend on port 3001, then from the repository root:

```bash
PORT=3000 pnpm --filter @workspace/mars-trade-journal run dev
```

The local Vite proxy sends `/api` to `http://127.0.0.1:3001`. Set `API_PROXY_TARGET` on the Vite process to override that local target. This variable does not change production routing.
