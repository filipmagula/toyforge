# ToyForge 3D

Kids build 3D-printable figurines on a tablet and either download the `.STL` or send it to their teacher's class with a 6-letter code. Teachers create a class (no account), share the code or QR, and batch-download submissions as a ZIP for printing. Everything is deleted automatically 30 days after a class's last activity.

- **Spec:** [docs/superpowers/specs/2026-11-23-toyforge-design.md](docs/superpowers/specs/2026-11-23-toyforge-design.md)
- **Deploy:** [deploy/README.md](deploy/README.md) (Hetzner VPS, nginx, Docker, `toyforge.chupa.nexus`)
- **Original prototype + draft spec:** [inputs/](inputs/)

## Layout

| Path | What |
|---|---|
| `packages/shared` | Rules shared by client and server: names, class codes, recipe schema, filenames, API types |
| `apps/server` | Fastify + SQLite API, static file serving, hourly retention job |
| `apps/web` | Vite + TypeScript (no framework): builder (`/`), teacher (`/teacher`), privacy (`/privacy`); en / cs / pl |
| `deploy` | docker-compose, nginx site config, deploy guide |

## Develop

```bash
npm install
npm run dev:server   # API on :3000, data in ./data
npm run dev:web      # Vite on :5173, proxies /api to :3000
```

## Test

```bash
npm test             # unit + API tests (all workspaces)
npm run typecheck
npx playwright install webkit && npm run e2e   # end-to-end on iPad + iPhone (WebKit)
npm run build        # web → apps/web/dist, server → apps/server/dist/main.js
```

## Languages

UI strings live in `apps/web/src/i18n/{en,cs,pl}.ts`. A test fails if Czech or Polish is missing a key or a `{placeholder}`. Czech and Polish texts were drafted by the developer and should be proofread before the first workshop.
