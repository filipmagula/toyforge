# ToyForge 3D — Application Specification

**Date:** 2026-11-23
**Status:** Approved 2026-11-23
**Deploy target:** Hetzner VPS, `https://toyforge.chupa.nexus`
**Inputs:** `inputs/3d_character_creator_product_technical_specification.md` (v2.0 draft), `inputs/3d_kid_character_maker_stl_exporter.html` (working client prototype)

This document supersedes the v2.0 draft wherever they differ. Items marked **(builder's call)** were decided during spec writing without explicit owner input and may be revisited.

---

## 1. Intent

ToyForge 3D lets children build a 3D-printable figurine on a tablet or phone from modular parts, then either download the `.STL` themselves or send it to their teacher/organizer, who batch-downloads all submissions for printing.

It runs as a single public website. There are **no user accounts**. Anyone can create a *class*; the class's 6-letter code is the only thing that allows submissions to the server. Without a code the app is a fully working, local-only builder.

### Why the class-code model
- Public deployment without accounts must not become an open upload bucket. The code gates all uploads.
- Teachers should be able to run a workshop in two minutes: create class → show QR code → kids build.
- Children's data (nicknames + models) is short-lived by design.

## 2. Goals, non-goals, anti-goals

**Goals**
1. Kids build a figurine with the existing part library and download an STL — no code, no server, no sign-up.
2. Kids with a class code send their model (STL + thumbnail + recipe) to that class.
3. A teacher creates a class, gets a class code + QR code + private teacher link, and manages submissions from a dashboard (review, status, delete, single and ZIP download).
4. All class data is automatically deleted 30 days after the class's last activity.
5. Runs reliably on one Hetzner VPS with Docker Compose and automatic HTTPS.

**Non-goals**
- User accounts, email, password reset, OAuth.
- Recovering a lost teacher link.
- Public gallery or sharing models between classes.
- Kids editing/withdrawing a model after submission.
- Multi-colour printing (STL carries no colour; colours are preview-only).
- Slicing, printer control, or print-farm integration.

**Anti-goals** (failure even if it technically works)
- A kid is blocked from building or downloading because of the code, the network, or a form.
- Children's data persisting beyond the retention window, or being exposed to anyone without the teacher link.
- The teacher link leaking through logs, referrers, or the class code.
- The app breaking on workshop Wi-Fi because a third-party CDN is slow or blocked.
- Losing a kid's submission silently when Wi-Fi drops.

## 3. Approaches considered

| Approach | Summary | Trade-off | Decision |
|---|---|---|---|
| **A. TypeScript everywhere, no UI framework** | Prototype ported to Vite + TS modules with bundled modern Three.js; Node + Fastify + SQLite server; one language | Hand-written UI glue, but the UI is small | **Chosen** |
| B. Angular frontend + Node server | Angular for panels/dashboard, Three.js in a component | Heavy for a canvas-centred app; fights the drag-safe slider design | Rejected — owner: no Angular |
| C. Keep single HTML file + Python FastAPI | Minimal client change | Stays CDN-bound on Three r128, two languages, hard to grow | Rejected |

**Framework rule (owner):** Angular must not be used. If a UI framework becomes necessary (e.g. the teacher dashboard grows), use **Vue or React**. Default is vanilla TypeScript.

### 3.1 Platform & language decisions (owner)
- **Devices:** primarily iPads on up-to-date iPadOS; also current Android/iOS phones. WebGL2 is required (current Three.js). Devices without WebGL2 get a friendly, localised *"This device can't run ToyForge"* screen instead of a broken canvas. Build target: Safari 16+, Chrome/Edge 110+, Firefox 115+.
- **Languages:** English, Czech, Polish (`en`, `cs`, `pl`). All user-facing strings (kid app, teacher dashboard, privacy page, server error `message`s shown to users) come from a string catalogue — no hard-coded UI text. Language is picked from `?lang=` → saved choice (localStorage) → `navigator.languages` → fallback `en`. A visible language switcher (flags/labels) on every page. Part and colour names are translated too; recipe values stay as stable English identifiers. Server returns machine `error` codes; the client maps them to localised text. Teacher dashboard ZIP `manifest.csv` headers stay English **(builder's call)**.
- **Hosting:** the VPS already runs **nginx** serving other `chupa.nexus` sites (e.g. `flow.chupa.nexus`). ToyForge plugs into it; no Caddy.

## 4. Users and flows

### 4.1 Kid — local only (no code)
1. Opens `https://toyforge.chupa.nexus/`.
2. Builds a character (blank mannequin start, *Blank* reset, *Mix!* randomizer, base toggle — as in the prototype).
3. *Finish & 3D Print!* → enters maker nickname (required) and optional character name → **Download STL**.
4. The *Send to class* action is visible but asks for a class code; without one, nothing is sent.

### 4.2 Kid — with class code
1. Arrives via `https://toyforge.chupa.nexus/?class=KQMTRB` (QR / link) **or** types the code in the app.
2. The app checks the code (`GET /api/classes/:code`) and shows the class name, e.g. *"Class: Saturday Makerspace ✓"*. Invalid/expired/closed codes show a friendly message; building still works.
3. Code and nickname are remembered on the device (localStorage) so the next kid on a shared tablet sees them pre-filled and can change them.
4. *Finish* → **Send to class** (primary) and **Download STL** (secondary) are both available.
5. On success: celebratory confirmation. On network failure: the submission is stored in the on-device queue and retried automatically (§6.5). The UI shows *"1 model waiting to send"*.

### 4.3 Teacher
1. Opens `https://toyforge.chupa.nexus/teacher` → **Create class** (optional class name, e.g. "3B Robotics", max 40 chars).
2. Receives:
   - **Class code** (6 letters) + **QR code** of the kid link + copyable kid link.
   - **Private teacher link**, with a clear "Bookmark / save this link — it is the only way back into this class" warning and a copy button.
3. The teacher link opens the class dashboard (§7). The browser also remembers teacher links locally, so `/teacher` lists *"Classes on this device"* **(builder's call)**.
4. Teacher can show a full-screen **presentation view** (big code + QR) for projecting to the room **(builder's call)**.
5. Teacher can **close** submissions (code stops accepting uploads, data kept) and **reopen**, or **delete the class now**.

## 5. Identifiers and secrets

### 5.1 Class code
- 6 uppercase letters from an alphabet excluding look-alikes: `ABCDEFGHJKMNPQRSTUVWXYZ` (no `I`, `L`, `O`). ~148 M combinations.
- Input is case-insensitive and ignores spaces/dashes; displayed as `KQM TRB` for readability.
- Generated server-side with a CSPRNG; retry on collision with any existing class.
- The code is **not secret**: it only allows submitting to the class and reading the class's display name and open/closed status.

### 5.2 Teacher key
- 32 random bytes, base64url-encoded (43 chars). Generated server-side at class creation, shown **once**.
- Stored only as a SHA-256 hash in the DB.
- Teacher link format: `https://toyforge.chupa.nexus/teacher#key=<teacherKey>` — the key lives in the URL **fragment**, so it is never sent in HTTP requests, never appears in server/proxy access logs, and never leaks via `Referer` **(builder's call; refines the `/teacher/<secret>` idea discussed)**.
- The dashboard sends it as `Authorization: Bearer <teacherKey>` on every admin API call. No cookies.
- One key per class; the key identifies the class (no separate class ID needed in the link).

## 6. Client application (kid builder)

### 6.1 Baseline
The prototype (`inputs/3d_kid_character_maker_stl_exporter.html`) is the functional and visual reference. Preserve:
- Layouts: tablet split (≈60–66% viewport left / 34–40% panel right, 3-col option cards), phone stacked (≈46% viewport top / 54% drawer, 4-col compact grid).
- OrbitControls with damping, pinch zoom, the camera limits, the build-plate + grid visual.
- 24 px slider thumbs; slider input updates the 3D scene and label **without re-rendering the panel DOM** (prevents pointer-capture loss).
- The complete part library, colour palette (12 named colours), colour zones, and printability rules in §2.3 of the v2.0 draft (head 75–145%, body 80–130%, base pedestal, joint overlap, solid cores).
- Blank / Mix! / Base ON-OFF, the *Finish & 3D Print!* modal.
- Fredoka font, playful "toy button" styling.

### 6.2 Port requirements
- **Vite + TypeScript**, ES modules. Suggested split: `state/recipe.ts`, `scene/setup.ts`, `parts/*.ts` (one module per category), `export/stl.ts`, `ui/panel.ts`, `ui/finish-modal.ts`, `net/submit.ts`, `net/queue.ts`.
- **Three.js current release** installed from npm and bundled (OrbitControls and STLExporter from `three/examples/jsm`). Note: r128 → current changes colour management and light intensity units; re-tune lights/materials so the look matches the prototype.
- Dispose geometries/materials when rebuilding the character (prototype creates new materials on every rebuild, including during slider drags).
- **No runtime CDNs.** Tailwind compiled at build time; Fredoka font self-hosted; icons bundled (replace Font Awesome — the prototype uses icons such as `fa-eyes`/`fa-party-horn` that are not in the free set — with a bundled free set, e.g. Lucide, or inline SVG).
- Recipe (`charState`) becomes a typed, versioned object: `{ version: 1, ...parts, colors }`. Maker/character names are **not** part of the recipe.

### 6.3 Names — unified limits
Single source of truth in a shared package, enforced on client and server:
- **Maker nickname:** required, 1–20 chars after trim.
- **Character name:** optional, 0–24 chars; server stores `"Untitled Creature"` when empty.
- **Class name:** optional, 0–40 chars.
- Allowed: Unicode letters, digits, space, `-`, `_`, `'` (kids may use accented letters, e.g. "Šimon"). Strip control characters.
- Under the nickname field, a short hint: *"Use a nickname or first name only."*

### 6.4 STL export
- Same as prototype: clone `characterGroup`, rotate +90° X (Y-up → Z-up), scale ×10 (≈75–85 mm tall), binary STL via `STLExporter`.
- Download filename: `{maker}_{character}_{YYYYMMDD}.stl`, ASCII-folded and sanitized (`šimon` → `simon`); fallback `maker` / `character`.

### 6.5 Submission and offline queue
- Thumbnail: render the canvas and downscale to max **512×512 PNG** (well under the 2 MB limit on high-DPI tablets).
- Each submission gets a client-generated **UUID `submissionId`** used as an idempotency key — retries never create duplicates.
- Send flow: `POST /api/classes/:code/models` (multipart). On network error / 5xx / 429: store `{submissionId, code, names, recipe, stl Blob, thumbnail Blob, createdAt}` in **IndexedDB**, show pending count, retry on `online` events, on app start, and with backoff (e.g. 5 s → 5 min).
- On 4xx other than 429 (invalid code, closed class, validation error): do not retry; show the reason and keep the item so the kid can still **download** it, then let them discard it.
- Queued items survive page reloads and tablet sleep.

### 6.6 Kid-facing errors (examples)
- Unknown/expired code: *"We can't find class KQM TRB. Check the code with your teacher."*
- Closed class: *"This class isn't taking new models right now."*
- Offline: *"No internet — your model is saved and will send automatically."*

## 7. Teacher dashboard (`/teacher`)

Loaded as a separate page from the same Vite build. If no `#key=` fragment: show *Create class* and *Classes on this device*. With a key: dashboard.

**Header:** class name, code (big), QR button / presentation view, copy kid link, copy teacher link, open/closed toggle, *"Auto-deletes on 23 Dec 2026"* (last activity + 30 days), *Delete class now* (confirm dialog).

**Summary bar:** counters — Total, New, Queued, Printed. Buttons: **Download unprinted (.ZIP)** (status `new`, marks them `queued`), **Download everything (.ZIP)**.

**Cards grid** (newest first, filter by status): thumbnail, *"By: Maya"*, character name, file size (e.g. "340 KB"), time submitted, status pill, actions: Download STL · Mark queued / printed / new · Delete (confirm).

**3D preview (optional, builder may defer):** clicking a card opens the model in a viewer rebuilt from its recipe.

Refreshes on demand and polls every ~15 s while visible **(builder's call)**.

## 8. Server

### 8.1 Stack
- Node.js 22 LTS, **Fastify**, TypeScript.
- **SQLite** via `better-sqlite3` (WAL mode), single file in the data volume.
- Files on local disk under `DATA_DIR`.
- ZIP streaming via `archiver`.
- Validation schemas shared with the client (e.g. `zod` in `packages/shared`).
- Fastify also serves the built static client (one app container) **(builder's call)**.

### 8.2 Data model

```sql
CREATE TABLE classes (
  id                TEXT PRIMARY KEY,           -- UUIDv4
  code              TEXT NOT NULL UNIQUE,       -- 6 letters, uppercase
  name              TEXT NOT NULL DEFAULT '',
  teacher_key_hash  TEXT NOT NULL UNIQUE,       -- sha256(teacherKey), hex
  is_open           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,              -- ISO 8601 UTC
  last_activity_at  TEXT NOT NULL               -- drives 30-day expiry
);

CREATE TABLE models (
  id                TEXT PRIMARY KEY,           -- = client submissionId (UUIDv4)
  class_id          TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  maker_name        TEXT NOT NULL,
  character_name    TEXT NOT NULL,              -- 'Untitled Creature' if empty
  stl_size_bytes    INTEGER NOT NULL,
  triangle_count    INTEGER NOT NULL,
  recipe_json       TEXT NOT NULL,
  print_status      TEXT NOT NULL DEFAULT 'new' CHECK (print_status IN ('new','queued','printed')),
  created_at        TEXT NOT NULL
);
CREATE INDEX models_class ON models(class_id, created_at);
```

Files: `DATA_DIR/classes/{class_id}/{model_id}.stl` and `.../{model_id}.png`. Disk names are always UUIDs; kid-friendly names appear only in `Content-Disposition` and ZIP entries. `archived` status from v2.0 dropped (deletion + expiry cover it).

**Last activity** is updated on: class creation, accepted submission, any teacher write action (status change, delete, open/close, ZIP download).

### 8.3 API

All JSON responses; errors as `{ "error": "<machine_code>", "message": "<human text>" }`.

**Public**

| Method & path | Purpose |
|---|---|
| `POST /api/classes` | Create class. Body `{ name? }`. → `201 { code, name, teacherKey, kidUrl, teacherUrl, expiresAt }`. `teacherKey` returned only here. |
| `GET /api/classes/:code` | Check code. → `200 { code, name, isOpen }` or `404`. Expired classes are `404`. |
| `POST /api/classes/:code/models` | Submit (multipart): `submissionId` (UUID), `makerName`, `characterName?`, `recipeJson`, `stlFile`, `thumbnail`. → `201 { id, makerName, characterName, createdAt }`. Same `submissionId` resubmitted → `200` with the existing record. `404` unknown code, `409 class_closed`, `400` validation, `413` too large, `429` rate limited. |
| `GET /api/health` | Liveness + DB check. |

**Teacher** (`Authorization: Bearer <teacherKey>`; the key resolves the class)

| Method & path | Purpose |
|---|---|
| `GET /api/teacher/class` | Class info + counters + `expiresAt`. |
| `PATCH /api/teacher/class` | `{ name?, isOpen? }`. |
| `DELETE /api/teacher/class` | Delete class, all models and files. |
| `GET /api/teacher/models?status=new\|queued\|printed\|all` | List models with `thumbnailUrl`, `stlUrl`. |
| `GET /api/teacher/models/:id/thumbnail` | PNG. |
| `GET /api/teacher/models/:id/stl` | STL, `Content-Disposition: attachment; filename="maya_captain_tentacle_8f14.stl"`. |
| `PATCH /api/teacher/models/:id` | `{ printStatus }`. |
| `DELETE /api/teacher/models/:id` | Remove row + files. |
| `GET /api/teacher/models.zip?status=new\|all&markAsQueued=true` | Streams `toyforge_{CODE}_{YYYY-MM-DD}.zip` with STLs + `manifest.csv` (maker, character, created_at, status, filename). |

Because thumbnails/STLs are fetched with a bearer header, the dashboard loads them via `fetch` → object URLs (not plain `<img src>`). ZIP download likewise via `fetch` + blob, or via a short-lived signed URL (`?t=…`, 60 s) **(builder's call which)**.

ZIP/STL filename rules: ASCII-folded sanitized `{maker}_{character}_{first 4 of id}.stl` — the id suffix prevents collisions between identical names.

### 8.4 Validation
- Request size ≤ 10 MB; STL ≤ 10 MB; thumbnail ≤ 2 MB; recipe JSON ≤ 32 KB.
- STL must be binary with `84 + 50 × triangleCount == byteLength`, `1 ≤ triangleCount ≤ 200 000`.
- Thumbnail must start with PNG magic bytes; dimensions ≤ 1024×1024.
- Recipe validated against the shared versioned schema (unknown part values rejected).
- Names validated per §6.3 (server re-trims and re-checks).
- Max **500 models per class**; beyond → `409 class_full`.

### 8.5 Abuse & rate limits **(builder's call on exact numbers)**
A whole classroom often shares one public IP, so limits must not trip a normal class:
- Submissions: 60/min per IP and 300/hour per class.
- Class creation: 10/hour per IP.
- Code lookup (`GET /api/classes/:code`): 60/min per IP (makes code enumeration impractical).
- Teacher endpoints: 300/min per key; failed bearer auth: 20/min per IP.
- In-memory limiter is sufficient (single instance). Trust `X-Forwarded-For` only from the reverse proxy.

### 8.6 Retention
- A scheduled job (in-process, hourly) deletes classes where `last_activity_at < now − RETENTION_DAYS` (default 30), including all files. Deleting directories is done after the DB row is gone; orphaned directories are swept too.
- Expired classes are treated as non-existent immediately even before the job runs.

## 9. Privacy & security
- Data collected: nickname, optional character/class names, model, thumbnail, timestamps. No emails, no accounts, no tracking, no analytics, no third-party requests (fonts/icons self-hosted).
- Only localStorage/IndexedDB on device (remembered code, nickname, teacher links, pending queue). No cookies → no cookie banner.
- A short **privacy page** (`/privacy`) in plain language: what's stored, 30-day deletion, nicknames recommended, operator contact. Linked from both pages' footers. Operator contact: **filip.magula@gmail.com**.
- Teacher key only in URL fragment, only hashed at rest, compared in constant time.
- Security headers via proxy/app: HSTS, `Content-Security-Policy` (self only; `blob:`/`data:` for images), `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- All user strings rendered as text (no `innerHTML` with user data — the prototype does this in the finish modal; fix in the port).
- Server logs must not include request bodies or Authorization headers.

## 10. Deployment

### 10.1 Topology
```
Internet ──443──> existing nginx (TLS via certbot / Let's Encrypt) ──> 127.0.0.1:3000 app (Fastify: API + static)
                                                                     └── ./data volume (SQLite + files)
```
- `deploy/docker-compose.yml` with one service, `app` (multi-stage Node 22 build), published only on `127.0.0.1:${PORT}` (default 3000; pick another if taken on the VPS). Volume `./data:/data`. `restart: unless-stopped`.
- `deploy/nginx/toyforge.chupa.nexus.conf`: server block for `toyforge.chupa.nexus` proxying to `127.0.0.1:3000`, with `client_max_body_size 12m`, `proxy_set_header X-Forwarded-For/Proto/Host`, `proxy_buffering off` for ZIP streaming, gzip for static assets, and the security headers from §9. TLS obtained with `certbot --nginx -d toyforge.chupa.nexus` (same method assumed as for existing sites; adapt if they use something else).
- DNS: `A` (and `AAAA` if IPv6) record `toyforge.chupa.nexus` → VPS IP. Ports 80/443 already open for existing sites.
- `deploy/README.md`: step-by-step first deploy and update instructions.

### 10.2 Configuration (env)
| Var | Default | Meaning |
|---|---|---|
| `PUBLIC_URL` | `https://toyforge.chupa.nexus` | Base for kid/teacher links and QR codes |
| `PORT` | `3000` | App port |
| `DATA_DIR` | `/data` | SQLite + files |
| `RETENTION_DAYS` | `30` | Inactivity expiry |
| `MAX_MODELS_PER_CLASS` | `500` | |
| `TRUST_PROXY` | `loopback` | Honour `X-Forwarded-For` only from nginx on localhost |

### 10.3 Operations
- Deploy: `git pull && docker compose up -d --build` (CI/CD optional, out of scope for v1).
- Backups: not required (data is ephemeral by design); a Hetzner server snapshot before upgrades is enough.
- Container healthcheck on `/api/health`.
- Disk sizing: 500 models × ~1 MB ≈ 0.5 GB per full class; log a warning when free disk < 1 GB.

## 11. Repository layout **(builder's call)**
```
/apps/web        Vite multi-page: index.html (builder), teacher.html, privacy.html
/apps/server     Fastify API, retention job, static serving
/packages/shared Recipe schema, name rules, code alphabet, API types
/apps/web/src/i18n  en.ts, cs.ts, pl.ts string catalogues (typed; cs/pl must cover every en key)
/deploy          docker-compose.yml, nginx site config, deploy README (Dockerfile at repo root)
/inputs          original spec + prototype (reference only)
```
npm workspaces. Update `.gitignore` (currently Angular-oriented) to cover `node_modules`, `dist`, `data/`, `.env`, `.DS_Store`.

## 12. Testing
- **i18n:** a test fails if `cs` or `pl` is missing any key present in `en`.
- **Shared:** unit tests for name validation, code generation/normalisation, recipe schema.
- **Server (Vitest + Fastify inject):** class lifecycle, submission happy path, idempotent resubmit, STL size/triangle validation, closed/full/expired class, bearer auth, ZIP contents + `markAsQueued`, retention job deletes rows and files.
- **Client:** unit tests for STL export (triangle-count consistency, Z-up, ~75–85 mm height on the default figure) and the offline queue (IndexedDB mocked).
- **E2E (Playwright, iPad + phone viewports, WebKit):** create class → open kid link → build → send → appears in dashboard → ZIP download; offline send recovers after reconnect.
- Manual: real iPad + Android phone touch check (orbit, pinch, sliders) before first workshop.

## 13. Left to the builder
- Exact module boundaries, component structure, and whether the teacher dashboard uses vanilla TS or Vue/React.
- QR generation library (client-side, bundled).
- Precise rate-limit numbers and backoff timings within the stated intent.
- Visual design of the teacher page (should share the kid app's palette and font, but can be calmer and denser).
- Light/material re-tuning after the Three.js upgrade.
- Czech and Polish translations: builder drafts them (kid-friendly, short); owner proofreads before the first workshop.
