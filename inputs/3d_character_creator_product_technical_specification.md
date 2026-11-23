# ToyForge 3D — Full System Specification (Client & Server)

**Version:** 2.0 (Draft)  
**Date:** November 2026  
**Target Environment:** Tablet-First Web App (iPad/Android), Mobile Web (iOS/Android), & Workshop Print Server

---

## 1. System Overview & Architecture

**ToyForge 3D** is a kid-friendly 3D character and creature modeling application built for classrooms, makerspaces, workshops, and home 3D printing. Children assemble custom 3D figurines from modular, manifold-friendly primitives and submit them—along with their mandatory creator name—to a central workshop server where an organizer can review and batch-download all `.STL` files for 3D printing.

```
+-----------------------------------+          HTTPS / REST          +-----------------------------------+
|         CLIENT (Browser)          |  --- POST /api/models ------>  |       SERVER (Node / Python)      |
| - Three.js 3D Procedural Builder  |  (STL binary + PNG + JSON)     | - REST API & Auth Middleware      |
| - Tablet & Mobile Responsive UI   |                                | - Disk / S3 Object Storage        |
| - Local Binary STL Exporter       |  <-- GET /api/models/zip ----  | - SQLite / PostgreSQL Metadata DB |
| - Client-Side Offline Queue       |                                | - Admin Workshop Gallery UI       |
+-----------------------------------+                                +-----------------------------------+
```

---

## 2. Client-Side Specification (Implemented PoC Baseline)

### 2.1. Platform & Responsive UX Strategy
* **Primary Platform — Tablets (`768px – 1280px`):**
  * Split-screen layout: 60–66% interactive Three.js 3D viewport on the left; 34–40% category & part selector panel on the right.
  * Chunky, visual icon cards (`3 columns`) with minimal text and large touch targets.
  * Direct touch gestures: one-finger orbit, two-finger pinch-to-zoom, and damped camera inertia.
* **Secondary Platform — Mobile Phones (`< 640px`):**
  * Stacked split layout: 46% height 3D viewport on top; 54% height compact builder drawer on bottom.
  * High-density `4-column` grid with smaller buttons (`py-1.5 px-1`), compact icons, and condensed spacing to minimize vertical scrolling on narrow viewports.
* **Touch-Safe Sliders:**
  * Custom `24px` range slider thumbs.
  * Slider `oninput` handlers mutate the 3D scene and percentage label directly without re-rendering the DOM panel, preventing pointer-capture loss during drag gestures.

### 2.2. Creator Attribution & Onboarding
* **Clean Blank Dummy Start:** The app initializes with a neutral, simple mannequin figure (round head, basic torso, arms, legs, simple smile/eyes, no accessories) plus a **"Blank"** reset button in the top bar and a **"Mix!"** randomizer button.
* **Mandatory Maker Name:**
  * Accessible via a persistent input field in the top header bar and enforced in the **"Finish & 3D Print!"** modal.
  * Validation blocks `.STL` download or server submission until a non-empty creator name (`1–20` chars) is provided.
  * Optional **Character Name** (`1–24` chars) for personalizing the creation.
  * Sanitized filename generation: `{makerName}_{characterName}_{YYYYMMDD}.stl` (e.g., `lukas_captain_tentacle_20261123.stl`).

### 2.3. Modular 3D Part Library & Manifold Printability Rules
All parts are constructed from Three.js primitives engineered with **intentional joint overlap** and **solid internal cores** so slicers treat the entire character as a single continuous, manifold-like solid without detached pieces falling off during or after printing:

| Category | Available Options | 3D Printability / Structural Engineering |
| :--- | :--- | :--- |
| **Head** | Block, Round, Tin Can, Retro TV, Alien Blob, Dino Snout + **Chibi Size Slider (`75%–145%`)** | Deeply seated onto a thick cylindrical neck core. |
| **Face & Ears** | **Eyes:** Visor, Round, Pixel, Cyclops, 3-Eye Alien, Googly, Star Eyes<br>**Mouth:** Happy, Fangs, Bot Grille, Blocky, Surprised, Mustache<br>**Nose:** None, Button, Pig Snout, Trunk, Pointy, Block<br>**Ears:** None, Hero Ears, Elf/Goblin, Cat/Fox, Floppy Dog, Bot Dishes | All facial features and side ears are extruded in 3D and embedded directly into the head mesh surface. |
| **Hair & Hats** | **Hair:** No Hair, Spiky, Curly Puff, Pigtails, Mohawk<br>**Hats:** None, Horns, Bunny, Mouse, Crown, Antenna, Cap, Space Fin | Skull caps and wide bolted bases anchor all spikes, antennas, horns, and ears into the top of the head. |
| **Body** | Bot Chest, Hero Torso, Blocky, Mecha Armor, Monster Belly + **Body Size Slider (`80%–130%`)** | Intersects both the lower hip/leg joints and upper neck core. |
| **Back & Tail** | None, Jetpack, Super Cape, Wings, Shell, Dino Tail | Jetpacks and wings attach via thick dorsal mounting blocks fused into the torso back. |
| **Arms** | Bot Claws, Hero Hands, Block Arms, Flex Tubes, Tentacles | Spherical shoulder joints bridge torso and upper arms cleanly. |
| **Gear (L & R)** | Empty, Sword, Wand, Shield, Ray Gun, Ice Cream, Wrench | Independently equippable per hand; grips intersect hand geometry. |
| **Legs & Feet** | **Legs:** Block Legs, Hero Legs, Springs, Mega Wheel, 6 Tentacles<br>**Feet:** Bot Boots, Sneakers, Block Feet, Flippers, Monster Paws | Spring legs include a solid central shaft; Mega Wheel uses a thick axle housing; 6-Tentacle base flares outward for bed adhesion. |
| **Print Base** | Toggleable circular pedestal (`Base: ON / OFF`) | Provides a flat first layer (`0.35` units thick) so top-heavy figures stand reliably without tipping. |

### 2.4. Client-Side `.STL` Export & Submission Staging
* **Coordinate & Scale Normalization:** Clones the Three.js `characterGroup`, rotates `+90°` around the X-axis (`Y-up` $\rightarrow$ `Z-up` slicer standard), and applies a `10x` scale factor (~`75 mm – 85 mm` real-world print height).
* **Binary `.STL` Generation:** Uses `THREE.STLExporter` (`{ binary: true }`) to produce compact binary `.STL` buffers (`~150 KB – 600 KB` per model).
* **Thumbnail Capture:** Captures a `PNG` snapshot of the WebGL canvas (`preserveDrawingBuffer: true`) at submission time.
* **Offline / Local Staging Queue:** Stores generated `.STL` blobs, thumbnails, and JSON recipes in memory so models can be queued even if Wi-Fi drops temporarily during a workshop.

---

## 3. Server-Side Specification (To Be Implemented)

### 3.1. Goals & Requirements
1. Receive 3D model submissions (`.STL` binary, `.PNG` thumbnail, creator metadata, and JSON part recipe) from tablets and phones on the local network or internet.
2. Persist model files safely on disk (or S3-compatible storage) and index metadata in a lightweight database.
3. Provide an **Organizer / Teacher Admin Dashboard** to inspect submitted models, track print status (`New`, `Queued`, `Printed`), delete duplicates/spam, and **batch-download all `.STL` files as a single `.ZIP` archive**.

### 3.2. Recommended Tech Stack
* **Runtime & Framework:** Node.js (Express or Fastify) **or** Python (FastAPI).
* **Database:** SQLite (via `better-sqlite3` or `SQLAlchemy`) — zero-config, single-file persistence ideal for workshops and small servers.
* **File Storage:** Local filesystem directory (`./storage/models/{session_id}/`) with structured subfolders for `/stl` and `/thumbnails`.
* **ZIP Streaming:** `archiver` (Node.js) or `zipfile` (Python) for on-the-fly streaming `.ZIP` generation without high memory overhead.
* **Authentication:** Simple environment-configured Admin PIN / Bearer Token (`ADMIN_PASSWORD`) protecting admin read/delete/download routes, while `POST /api/models` remains open (rate-limited) for kids' tablets.

### 3.3. Database Schema (`models` Table)

```sql
CREATE TABLE models (
    id              TEXT PRIMARY KEY,          -- UUIDv4
    session_code    TEXT DEFAULT 'default',    -- Optional workshop/class grouping
    maker_name      TEXT NOT NULL,             -- Required kid's name (sanitized)
    character_name  TEXT NOT NULL,             -- Character title or 'Untitled Creature'
    stl_filename    TEXT NOT NULL,             -- e.g., "lukas_robot_a1b2.stl"
    stl_path        TEXT NOT NULL,             -- Relative path on disk
    thumb_path      TEXT NOT NULL,             -- Relative path to PNG preview
    file_size_bytes INTEGER NOT NULL,          -- STL byte size
    recipe_json     TEXT NOT NULL,             -- Full charState JSON for re-editing
    print_status    TEXT DEFAULT 'new',        -- 'new' | 'queued' | 'printed' | 'archived'
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.4. REST API Endpoints

#### A. Public / Kid Client Endpoints

* **`POST /api/models`** — Submit a newly created character
  * **Content-Type:** `multipart/form-data`
  * **Form Fields:**
    * `makerName` (string, required, max 30 chars)
    * `characterName` (string, optional, max 40 chars)
    * `sessionCode` (string, optional, defaults to `'default'`)
    * `recipeJson` (stringified JSON of `charState`, required)
    * `stlFile` (binary file, `.stl`, max `10 MB`)
    * `thumbnail` (image file, `.png`, max `2 MB`)
  * **Validation:**
    * Reject `400 Bad Request` if `makerName` is empty or `stlFile` is missing/invalid.
    * Verify binary STL header/triangle count consistency (`84 + 50 * numTriangles == byteLength`).
  * **Response (`201 Created`):**
    ```json
    {
      "id": "8f14e45f-ea3c-4d2b-9a11-0192837465ab",
      "makerName": "Lukas",
      "characterName": "Captain Tentacle",
      "stlFilename": "lukas_captain_tentacle_8f14.stl",
      "createdAt": "2026-11-23T14:15:00Z"
    }
    ```

#### B. Admin / Organizer Endpoints (Requires `X-Admin-Pin` Header or Session Cookie)

* **`GET /api/admin/models`** — List all submitted models
  * **Query Params:** `?status=new|queued|printed|all` & `?session=default`
  * **Response (`200 OK`):** Array of model metadata objects including `thumbnailUrl` and `downloadUrl`.

* **`GET /api/admin/models/:id/stl`** — Download single `.STL` file
  * **Headers:** `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename="lukas_captain_tentacle_8f14.stl"`

* **`GET /api/admin/models/download-zip`** — Batch download all `.STL` files
  * **Query Params:**
    * `?status=new` (optional: download only unprinted models, or `all` for everything)
    * `?markAsQueued=true` (optional: automatically transitions downloaded `'new'` models to `'queued'`)
  * **Behavior:** Streams a `.ZIP` archive named `toyforge_models_{YYYY-MM-DD}.zip` containing all matching `.STL` files plus a `manifest.csv` listing Maker Name, Character Name, Timestamp, and Filename.

* **`PATCH /api/admin/models/:id`** — Update print status
  * **Body:** `{ "printStatus": "printed" }`
  * **Response (`200 OK`):** Updated model record.

* **`DELETE /api/admin/models/:id`** — Remove a submission (deletes DB row + `.STL` and `.PNG` files from disk).

---

## 4. Admin Workshop Gallery UI (`/admin`)

A lightweight, single-page admin interface served directly by the backend:
1. **PIN Login Gate:** Simple numeric/text PIN prompt to unlock admin controls.
2. **Top Summary & Batch Action Bar:**
   * Counters: *Total Submitted*, *Ready to Print (`new`)*, *Printed*.
   * Primary CTA Button: **"Download All Unprinted (.ZIP)"** and **"Download Everything (.ZIP)"**.
3. **Submission Cards Grid:**
   * Displays the rendered **PNG thumbnail** of the character.
   * Prominent **Maker Name** badge (e.g., *"By: Maya"*) and Character Title.
   * File size (e.g., `340 KB`), timestamp, and quick action buttons:
     * **Download `.STL`** (individual)
     * **Mark Printed / Queued** toggle
     * **Delete** button

---

## 5. Security, Storage & Operational Safeguards
* **Filename Sanitization:** Strip all path traversal characters (`..`, `/`, `\`) and non-alphanumeric symbols on the server; generate disk filenames using the record's UUID while preserving the kid-friendly name in `Content-Disposition`.
* **Upload Limits & Rate Limiting:** Enforce `10 MB` max upload size per request and rate-limit `POST /api/models` (e.g., 20 submissions/minute per IP) to protect classroom servers.
* **Client Retry Sync:** When the server endpoint is connected in Phase 2, the client's `"Save to Workshop Queue"` button will upload immediately via `fetch('/api/models', { method: 'POST', body: formData })` and fall back to local retry if offline.