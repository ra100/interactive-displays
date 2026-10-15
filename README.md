# Interactive Displays

Self-hosted sci-fi interface displays for film and video sets. One server drives 6–15 browser displays
(TVs, tablets, monitors) in real time; screens are documents you can hand-write, generate or let AI edit, and
the look comes from swappable theme packs (Star Trek LCARS first, other UI families later).

> **Status: v2 rebuild, Phase 1 (core model and LCARS).** The design and roadmap live in
> [docs/plans/2026-10-14-feat-interactive-displays-v2-plan.md](docs/plans/2026-10-14-feat-interactive-displays-v2-plan.md).
> What works today and how to try it: [docs/showcase](docs/showcase/README.md) and
> [docs/ACCEPTANCE-TESTING.md](docs/ACCEPTANCE-TESTING.md). The v1 code is archived in [legacy/](legacy/README.md).

<p align="center">
  <img src="docs/showcase/phase-1/bridge-sidebar.png" alt="The LCARS bridge screen of the demo show" width="720" />
</p>

## Run it

**Docker** (recommended on set):

```bash
docker compose up -d
# then open http://<server-ip>:3010/d on every display
```

Data lives in the `displays-data` volume and survives restarts and upgrades.

**From source** (Node ≥ 22.18, pnpm 9):

```bash
pnpm install
pnpm build
pnpm start            # http://localhost:3010/d
```

## Displays

- Open `/d` on a display: it gets a stable id (for example `/d/d-3fa9c1`) stored in that browser.
- Or open `/d/<name>` to choose the id yourself (`/d/bridge-1`).
- The server's active show decides which screen each display shows; displays without their own screen get the
  show's default screen.
- If the network drops or the server restarts, the display keeps its last screen and shows a small
  `RECONNECTING` badge until it is back.
- Show states (normal, yellow alert, red alert, damaged, blackout in the demo) switch every display at once.
- `/d/<id>?theme=base` or `?variant=nemesis` previews another look on that display only; `/gallery` shows every
  frame, widget and decor piece of a theme.

Until the operator console arrives (Phase 2), drive the show over the REST API, for example:

```bash
curl -X POST http://<server>:3010/api/state -H 'content-type: application/json' -d '{"state":"red-alert"}'
curl -X PUT http://<server>:3010/api/displays/bridge-2 -H 'content-type: application/json' -d '{"screen":"tactical"}'
curl -X POST http://<server>:3010/api/displays/bridge-2/identify
```

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3010` | HTTP and WebSocket port |
| `HOST` | `0.0.0.0` | Interface to listen on |
| `DATA_DIR` | `./data` (`/data` in Docker) | Shows and screens; seeded with a demo show on first start |
| `LOG_LEVEL` | `info` | `fatal` … `trace`, or `silent` |

## Development

```bash
pnpm dev          # server :3010 + Vite :5176 with hot reload (open http://localhost:5176/d/test)
pnpm test         # unit and integration tests
pnpm test:e2e     # Playwright e2e (after pnpm build)
pnpm lint && pnpm typecheck && pnpm knip
```

Architecture, conventions and how to add widgets or themes: [AGENTS.md](AGENTS.md).

## Releases

Pushing a tag like `v0.1.0` publishes `ghcr.io/ra100/interactive-displays` for amd64 and arm64.
