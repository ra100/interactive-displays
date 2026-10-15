---
name: server
description: Work on packages/server (command layer, REST API, Socket.io, data directory, seed show, Docker). Use when changing the protocol, persistence, show states, display assignment, configuration, health check, static serving or deployment.
---

# Server

One Node process on one port serves `/health`, the REST API, Socket.io and the built app
(`packages/app/dist`) with an SPA fallback. Node runs the TypeScript sources directly (type stripping), so there
is no server build step: relative imports keep their `.ts` extension and only erasable syntax is allowed.

## Command layer

`src/showService.ts` is the single write path. REST (`src/http/api.ts`), Socket.io (`src/realtime.ts`) and later
MCP are thin adapters over it. Every command validates its input, persists, then emits a `ShowEvent`
(`screen`, `state`, `display`, `identify`) that the realtime adapter turns into snapshots or small events.
Writes that read-check-save (screens, displays) run through a queue, so two edits on the same revision cannot
both land. State changes are broadcast before they are saved: the 100 ms budget is for displays.

Failures are values (`{ ok: false, status, message, issues?, revision? }`), mapped to HTTP status codes.

## REST API

| Route | Does |
|---|---|
| `GET /api/catalog` | widgets (JSON Schema props), archetypes, effects, themes with variants and decor |
| `GET /api/show` | show, current state, screen summaries, displays (assigned, showing, connected, lastSeen) |
| `GET /api/screens/:id` | screen plus lint |
| `POST /api/screens` | create a screen (201) |
| `POST /api/screens/:id/ops` | `{ baseRevision, ops }`; 409 with `revision` when stale, 422 with issue paths |
| `POST /api/state` | `{ state }` |
| `PUT /api/displays/:id` | `{ name?, screen? }`; `null` clears |
| `POST /api/displays/:id/identify` | flash the display's name |

## Configuration (environment)

| Variable | Default |
|---|---|
| `PORT` | `3010` |
| `HOST` | `0.0.0.0` |
| `DATA_DIR` | `<repo>/data` (`/data` in Docker) |
| `APP_DIST` | `<repo>/packages/app/dist` |
| `LOG_LEVEL` | `info` |

## Data directory

```
settings.json                                    { "schemaVersion": 1, "activeShow": "demo" }
shows/<showId>/show.json                         Show: theme (+variant), states, defaultScreen, displays[]
shows/<showId>/runtime.json                      current state, last-seen displays (written by the server)
shows/<showId>/screens/<screenId>.json           Screen; file name must equal its id
shows/<showId>/screens/.history/<id>/<rev>.json  replaced revisions, last 50 kept
```

A data directory without `settings.json` is seeded from `packages/server/seed/` once; existing files are never
overwritten. Screens are validated on load; invalid ones are logged and skipped so one bad file never takes the
show down. All writes are atomic (temp file + rename) and serialized per file.

## Protocol

Typed in `packages/core/src/protocol`. A display emits `hello { role: 'display', displayId, protocol }` and gets a
`snapshot` (show with theme and states, current state, display, screen). Afterwards it gets a new snapshot when
its screen or assignment changes, `state { state }` for show-wide state changes, and `identify { label }`.
Errors arrive as `error { code, message }`. Bump `PROTOCOL_VERSION` on any breaking change: displays reload once
to fetch the matching bundle.

## Rules

- Validate every inbound payload with the Zod schema from `core`.
- Never trust ids for paths without `IdSchema` (it makes them path-safe).
- Graceful shutdown closes transports (`io.engine.close()`) and flushes runtime state, so displays reconnect on
  their own and the scene is restored.
- Tests: `showService.test.ts` against a temp data dir; integration tests start the real server on port 0 via
  `src/testing/testServer.ts` (`app`, `http/api`, `realtime`).
- Docker: keep the pnpm workspace layout in the image (see `Dockerfile`), including `packages/themes/src` for
  the manifests; test with `docker build` and the restart smoke test from CI.
