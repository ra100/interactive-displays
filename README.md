# Interactive Displays

Self-hosted sci-fi interface displays for film and video sets. One server drives 6–15 browser displays
(TVs, tablets, monitors) in real time; screens are documents you can hand-write, generate or let AI edit, and
the look comes from swappable theme packs (Star Trek LCARS first, other UI families later).

> **Status: v2 rebuild, Phase 2 (editor and operator console).** The design and roadmap live in
> [docs/plans/2026-10-14-feat-interactive-displays-v2-plan.md](docs/plans/2026-10-14-feat-interactive-displays-v2-plan.md).
> What works today and how to try it: [docs/showcase](docs/showcase/README.md) and
> [docs/ACCEPTANCE-TESTING.md](docs/ACCEPTANCE-TESTING.md). The v1 code is archived in [legacy/](legacy/README.md).

<p align="center">
  <img src="docs/showcase/phase-1/bridge-sidebar.png" alt="The LCARS bridge screen of the demo show" width="720" />
</p>
<p align="center">
  <img src="docs/showcase/phase-2/editor.png" alt="The screen editor" width="720" />
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

## Running the show

- **`/operator`** on a phone or tablet: show states (normal, alerts, damaged) and a blackout panic button; every
  display with a live thumbnail, its screen, Identify, Reload, Rename and a QR code to open it on a tablet.
- **`/builder`** on a laptop: the screen library and the editor. Edits are saved as a draft; displays change only
  when you press Publish. "Send to display" shows a draft on one display first; History restores any earlier
  revision; Live edit (for rehearsals) puts every edit on air at once.
- Set `EDITOR_TOKEN` to protect both; displays never need it. Open `/operator?token=<token>` once on a device (or
  scan its QR code) and the token is remembered.

Everything the tools do is also a REST call, for scripts:

```bash
curl -X POST http://<server>:3010/api/state -H 'content-type: application/json' -d '{"state":"red-alert"}'
curl -X PUT http://<server>:3010/api/displays/bridge-2 -H 'content-type: application/json' -d '{"screen":"tactical"}'
# with EDITOR_TOKEN set, add: -H 'authorization: Bearer <token>'
```

## AI and MCP

- **MCP:** point any MCP client (Claude Desktop, Claude Code, …) at `http://<server>:3010/mcp` (Streamable HTTP).
  It can read the catalog, theme and screens, generate screens and suites from a section, edit drafts with ops,
  check them and save new section recipes. Locked parts are never touched. With `EDITOR_TOKEN` set, send it as
  `authorization: Bearer <token>`.

  ```bash
  claude mcp add --transport http displays http://<server>:3010/mcp --header "Authorization: Bearer <token>"
  ```

- Publishing and running the show (assigning screens, changing state or signals) stay off for AI until the operator
  turns on **AI may publish** or **AI may run the show** in `/operator`.
- **Fill with AI** in the editor: with `ANTHROPIC_API_KEY` set, describe a change ("fill the placeholders", "make
  this the torpedo bay") and review the proposal before applying it; Undo takes it back.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3010` | HTTP and WebSocket port |
| `HOST` | `0.0.0.0` | Interface to listen on |
| `DATA_DIR` | `./data` (`/data` in Docker) | Shows and screens; seeded with a demo show on first start |
| `LOG_LEVEL` | `info` | `fatal` … `trace`, or `silent` |
| `EDITOR_TOKEN` | unset | Protects `/operator`, `/builder` and every change (at least 8 characters); displays never need it |
| `PUBLIC_URL` | unset | The address tablets use to reach the server (`http://10.0.0.5:3010`), for QR codes |
| `ANTHROPIC_API_KEY` | unset | Turns on the editor's Fill with AI; MCP clients bring their own model and need no key |
| `AI_MODEL` | `claude-opus-5-5` | The model Fill with AI uses |

With Docker, put them in a `.env` file next to `docker-compose.yml`.

## Development

```bash
pnpm dev          # server :3010 + Vite :5176 with hot reload (http://localhost:5176/d/test, /operator, /builder)
pnpm test         # unit and integration tests
pnpm test:e2e     # Playwright e2e (after pnpm build)
pnpm lint && pnpm typecheck && pnpm knip
```

Architecture, conventions and how to add widgets or themes: [AGENTS.md](AGENTS.md).

## Releases

Pushing a tag like `v0.1.0` publishes `ghcr.io/ra100/interactive-displays` for amd64 and arm64.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md) (see [NOTICE](NOTICE)): free to use, change and share for any
noncommercial purpose, including personal projects, fan films, study, and schools, charities or public bodies.
Commercial use needs a separate license from the author. Star Trek and LCARS are trademarks of CBS Studios and
are not covered by this license; this project is not affiliated with or endorsed by them.
