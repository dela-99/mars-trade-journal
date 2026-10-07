# Frontend

Independent React/Vite project. Install and run commands **inside this folder**.

## Vercel settings

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Install Command | `pnpm install --frozen-lockfile --prod=false` |
| Build Command | `pnpm run build` |
| Output Directory | `dist/public` |

`frontend/vercel.json` contains these settings. Replace `https://replace-with-your-render-service.onrender.com` there with the real Render backend URL, keeping `/api/:path*` in the destination. Vercel serves the frontend and forwards `/api` to Render. The browser uses its own domain for API calls and login cookies. Render's `BETTER_AUTH_URL` must equal the frontend's final HTTPS origin, without `/api`.

Never put database credentials or auth secrets in frontend environment variables. No files outside `frontend/` are required to install or build the frontend. The pnpm YAML stores package-manager security policy; this is an independent project, not a shared workspace.

## Local commands

```bash
pnpm install --frozen-lockfile --prod=false
pnpm run dev
pnpm run typecheck
pnpm test
pnpm run build
```

Development uses port 3000 and proxies `/api` to the backend on port 3001. Set `API_PROXY_TARGET` on the Vite process if using another local API target. Production uses the external rewrite in `vercel.json`.

The optional `mockup-sandbox/` is retained as a local design tool within this project. Run `pnpm run dev:mockup`; it is not a separate deployable service. The browser API client is ordinary source under `src/api-client/`.
