---
name: server
description: Work on packages/server (Fastify, Socket.io, data directory, seed show, Docker). Use when changing the protocol, persistence, configuration, health check, static serving or deployment.
---

# Server

One Node process on one port serves `/health`, Socket.io and the built app (`packages/app/dist`) with an SPA
fallback. Node runs the TypeScript sources directly (type stripping), so there is no server build step:
relative imports keep their `.ts` extension and only erasable TypeScript syntax is allowed.

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
settings.json                         { "schemaVersion": 1, "activeShow": "demo" }
shows/<showId>/show.json              Show: theme, defaultScreen, displays[]
shows/<showId>/screens/<screenId>.json Screen; file name must equal its id
```

A data directory without `settings.json` is seeded from `packages/server/seed/` once; existing files are never
overwritten. Screens are validated with `validateScreen` on load; invalid ones are logged and skipped so one bad
file never takes the show down.

## Protocol

Typed in `packages/core/src/protocol`. A display emits `hello { role: 'display', displayId, protocol }` and gets a
`snapshot` with everything it needs; errors arrive as `error { code, message }`. Bump `PROTOCOL_VERSION` on any
breaking change: displays reload once to fetch the matching bundle.

## Rules

- Validate every inbound payload with the Zod schema from `core`.
- Never trust ids for paths without `IdSchema` (it makes them path-safe).
- Graceful shutdown closes transports (`io.engine.close()`), so displays reconnect on their own.
- Integration tests start the real server on port 0 with a temp `DATA_DIR` (`app.integration.test.ts`).
- Docker: keep the pnpm workspace layout in the image (see `Dockerfile`); test with `docker build` and the
  restart smoke test from CI.
