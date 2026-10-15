---
name: server
description: Work on packages/server (command layer, REST API, Socket.io, data directory, seed show, Docker). Use when changing the protocol, persistence, show states, signals, display controls, display assignment, configuration, health check, static serving or deployment.
---

# Server

One Node process on one port serves `/health`, the REST API, Socket.io and the built app
(`packages/app/dist`) with an SPA fallback. Node runs the TypeScript sources directly (type stripping), so there
is no server build step: relative imports keep their `.ts` extension and only erasable syntax is allowed.

## Command layer

`src/showService.ts` is the single write path. REST (`src/http/api.ts`), Socket.io (`src/realtime.ts`) and later
MCP are thin adapters over it. Every command validates its input, persists, then emits a `ShowEvent`
(`screen`, `published`, `state`, `display`, `identify`, `reload`, `preview`, `show`, `signals`, `video`, …) that
the realtime adapter turns into snapshots or small events. Writes that read-check-save (screens, displays) run through a queue, so two edits
on the same revision cannot both land. State changes are broadcast before they are saved: the 100 ms budget is
for displays.

Failures are values (`{ ok: false, status, message, issues?, revision? }`), mapped to HTTP status codes.

**Drafts and publishing.** Ops edit the draft (`screens/<id>.json`) and bump its `revision`. Displays show the
published copy (`published/<id>.json`); `publish` copies the current draft there and records it in the draft's
`published`. With the show setting `liveEdit` on, every saved edit publishes itself. A draft preview
(`previews`, in memory only) makes one display show a draft until it is ended, the screen is deleted or the
server restarts.

**Signals** (`src/signals.ts`). The server owns shared signals: manual ones hold the value someone set (kept in
`runtime.json`), walking and waving ones are sampled from the clock every 250 ms (`SIGNAL_TICK_MS` in `app.ts`)
and only changes go out, merged into one `signals` event at most every 100 ms. Ambient signals and clocks never
reach the server: every display works them out from the same seed. Sampling lives in `core/signals`, so the
server and the displays agree.

**Controls.** A display emits `press { nodeId, value? }`. `press.ts` finds the node on the screen that display
shows and accepts it only if it is a visible interactive widget with actions. The server runs `navigate` and
`back` (not while previewing a draft) and, when the show setting `displayGlobalActions` is on, `setState` and
`setSignal`; the display runs `sound` and `video` itself. Navigation is a per-display stack in memory: what a
display shows is its draft preview, else where its buttons took it, else its assignment, else the show default.
A new assignment, a preview or forgetting the display clears it.

## REST API

Reads are open. With `EDITOR_TOKEN` set, every other method under `/api/` needs `authorization: Bearer <token>`
(401 otherwise).

| Route | Does |
|---|---|
| `GET /api/session` | `{ tokenRequired, tokenValid, publicUrl, ai }` for the tools (`ai` is `{ model }` or null) |
| `GET /api/catalog` | widgets (JSON Schema props), archetypes, effects, themes with variants and decor |
| `GET /api/show` | overview: show, current state, shared signal values, screen summaries (revision, published), displays (assigned, showing, preview, navigated, videos, connected, lastSeen) |
| `PUT /api/show/settings` | `{ liveEdit?, displayGlobalActions?, sounds?, aiPublish?, aiLiveControl? }` |
| `GET /api/content` | `{ packs }`: content packs with the show's saved recipes and blocks merged in |
| `PUT /api/content/:pack/recipes` | a recipe; added or replaced by id if the pack stays valid (422 with issues) |
| `PUT /api/content/:pack/blocks` | a block, the same way |
| `POST /api/generate` | `{ section, id?, name?, seed?, density?, aspect?, archetype?, suite? }` → `{ screens, lint }` (201) |
| `POST /api/screens/:id/fill` | `{ baseRevision, brief }` → `{ ops, screen, lint, summary }`: a proposal from the model working on a copy (`assistant.ts`); nothing is saved |
| `POST /api/screens/:id/regenerate` | `{ baseRevision, seed?, nodes? }`: regenerate what is not locked, or reroll the panels in `nodes` |
| `PUT /api/show/signals` | `{ signals }`: replaces the show's signal definitions (422 with issue paths) |
| `GET /api/signals` | `{ values }`: current values of the server-owned signals |
| `PUT /api/signals/:id/value` | `{ value }` or `{ delta }` for a shared manual signal, clamped and snapped to its step; 409 for any other signal |
| `GET /api/screens` | every draft |
| `GET /api/screens/:id` | draft plus lint and `onAir` (displays showing its published copy) |
| `GET /api/screens/:id/published` | the published copy |
| `POST /api/screens` | create a screen (201) |
| `POST /api/screens/:id/ops` | `{ baseRevision, ops }`; 409 with `revision` when stale, 422 with issue paths |
| `POST /api/screens/:id/publish` | publish the current draft; `{ revision }` guards it (409 if the draft moved on) |
| `GET /api/screens/:id/revisions` | `[{ revision, savedAt }]`, current first |
| `GET /api/screens/:id/revisions/:revision` | one revision |
| `POST /api/screens/:id/revert` | `{ baseRevision, revision }`: a new revision with the old content |
| `POST /api/screens/:id/duplicate` | `{ id?, name? }` (201) |
| `DELETE /api/screens/:id` | 409 while a display or the show default uses it; moves it to `.trash/` |
| `POST /api/state` | `{ state }` |
| `PUT /api/displays/:id` | `{ name?, screen? }`; `null` clears |
| `DELETE /api/displays/:id` | forget a display |
| `POST /api/displays/:id/identify` | flash the display's name |
| `POST /api/displays/:id/reload` | reload the display's page |
| `POST /api/displays/:id/video` | `{ target, command }`: play, pause, toggle or restart a video widget on the screen it shows (404 if there is none) |
| `PUT /api/displays/:id/preview` | `{ screen }`: show that draft on the display |
| `DELETE /api/displays/:id/preview` | end the preview |
| `GET /api/assets` | uploaded files with kind, type, size |
| `PUT /api/assets/:name` | raw file body (≤ 100 MB); served at `/media/<name>` |
| `DELETE /api/assets/:name` | remove a file |

## MCP

`/mcp` speaks MCP over Streamable HTTP, statelessly (POST only; a fresh server per request). With `EDITOR_TOKEN`
set, every request needs the bearer token, reads included. `src/mcp/server.ts` defines everything; tools call the
same `service` and `generation` functions as REST, so add a tool next to the REST route that does the same thing
and test both (`mcp.integration.test.ts` uses the SDK client).

- Discover: `get_catalog`, `get_theme`, `list_screens`, `get_screen` (outline or json, draft or published),
  `list_displays`, `list_recipes`, `list_blocks`.
- Make and edit: `generate_screen`, `generate_suite`, `regenerate`, `apply_ops` (always `respectLocks`),
  `create_screen`, `lint_screen`, `save_recipe`, `save_block`.
- Gated: `publish_screen` needs `settings.aiPublish`; `assign_screen`, `set_state`, `set_signal`, `video_command` need
  `settings.aiLiveControl`. Refusals are tool errors naming the operator switch.
- Resources: `interactive-displays://guide` (design rules, `src/mcp/guide.ts`), `://catalog`, `://recipes`,
  `://screens/{id}`. Prompts: `design-screen`, `fill-placeholders`, `new-section-recipe`.

Errors come back as tool results with `isError` and `{ error, status, issues?, revision? }`, like REST bodies.

## Configuration (environment)

| Variable | Default |
|---|---|
| `PORT` | `3010` |
| `HOST` | `0.0.0.0` |
| `DATA_DIR` | `<repo>/data` (`/data` in Docker) |
| `APP_DIST` | `<repo>/packages/app/dist` |
| `LOG_LEVEL` | `info` |
| `EDITOR_TOKEN` | unset: no protection; ≥ 8 characters |
| `PUBLIC_URL` | unset: QR codes use the browser's address |
| `ANTHROPIC_API_KEY` | unset: no Fill with AI (`/api/screens/:id/fill` answers 503, `/api/session` has `ai: null`) |
| `AI_MODEL` | `claude-opus-5-5` |

## Data directory

```
settings.json                                    { "schemaVersion": 1, "activeShow": "demo" }
shows/<showId>/show.json                         Show: theme (+variant), states, signals, settings, defaultScreen,
                                                 displays[]; read at start, rewritten whole on every change
shows/<showId>/runtime.json                      current state, shared manual signal values, last-seen displays
shows/<showId>/screens/<screenId>.json           draft Screen; file name must equal its id
shows/<showId>/screens/.history/<id>/<rev>.json  replaced revisions, last 50 kept
shows/<showId>/screens/.trash/<id>-<time>.json   deleted drafts
shows/<showId>/published/<screenId>.json         what displays show
shows/<showId>/assets/<name>                     uploaded images and video, served at /media/<name>
shows/<showId>/content/<packId>.json             the show's own recipes and blocks for a content pack
```

A data directory without `settings.json` is seeded from `packages/server/seed/` once; existing files are never
overwritten. Screens are validated on load; invalid ones are logged and skipped so one bad file never takes the
show down. All writes are atomic (temp file + rename) and serialized per file.

## Protocol

Typed in `packages/core/src/protocol` (`PROTOCOL_VERSION` 4). Clients emit `hello` with a role:

- `display { displayId }` joins `display:<id>` and gets a `snapshot` (show with theme, states, signals and the
  sounds setting, current state, shared signal values, display, screen, `preview` and `navigated` flags). A new
  snapshot follows whenever what it shows changes or the show's settings or signals change; `state { state }` for
  show-wide changes, `signals { values }` with changed shared values, `video { target, command }`,
  `identify { label }` and `reload`. A display emits `press { nodeId, value? }` when a control is used.
- `operator { token }` and `builder { token }` join `operators` / `builders` and get the show `overview` (the
  same shape as `GET /api/show`) on hello and after every change, and `signals` like the displays. A wrong token gets `error { code: "UNAUTHORIZED" }`.
- A builder emits `watch { screenId }` to join `screen:<id>` and receive `screen { screenId, screen, lint }` for
  every saved change to that draft (`screen: null` when it is deleted); `watch { screenId: null }` stops.

Errors arrive as `error { code, message }`. Bump `PROTOCOL_VERSION` on any breaking change: clients reload once
to fetch the matching bundle.

## Rules

- Validate every inbound payload with the Zod schema from `core`.
- Never trust ids for paths without `IdSchema` (it makes them path-safe).
- Graceful shutdown closes transports (`io.engine.close()`) and flushes runtime state, so displays reconnect on
  their own and the scene is restored.
- Tests: `showService.test.ts` against a temp data dir; integration tests start the real server on port 0 via
  `src/testing/testServer.ts` (`app`, `http/api`, `realtime`). E2e specs that need their own server or
  environment (restart, `EDITOR_TOKEN`) use `createManagedServer(port, env)` from `tests/e2e/support/server.ts`.
- Docker: keep the pnpm workspace layout in the image (see `Dockerfile`), including `packages/themes/src` for
  the manifests; test with `docker build` and the restart smoke test from CI.
