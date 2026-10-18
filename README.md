# Interactive Displays

Self-hosted sci-fi interface displays for film and video sets. One server drives 6–15 browser displays
(TVs, tablets, monitors) in real time; screens are documents you can hand-write, generate or let AI edit, and
the look comes from swappable theme packs: Star Trek LCARS, a holographic HUD and a green-screen terminal.

<p align="center">
  <a href="docs/showcase/video/showcase.mp4">
    <img src="docs/showcase/video/teaser.webp" alt="A sped-up tour of the app: LCARS consoles, alerts, the ship schematic, the Holo HUD and Terminal looks, the operator console and the editor" width="720" />
  </a>
  <br />
  <sub>The tour at 4× speed. <a href="docs/showcase/video/showcase.mp4"><b>Watch the full video</b></a> (3½ min, 1080p) ·
  <a href="docs/showcase/README.md"><b>Showcase</b></a> with screenshots of everything</sub>
</p>

**Status: v2 complete.** Three looks (LCARS in six eras, Holo HUD, green-screen Terminal), a screen editor with
drag-and-drop layout, one-click generation from content packs, an operator console with cues, show states from
yellow alert to a hull breach, a ship schematic traced from a 3D model, controls that set off timed beats on other
displays, portrait displays, and AI editing over MCP.
See the [showcase](docs/showcase/README.md) for what each part looks like and
[docs/ACCEPTANCE-TESTING.md](docs/ACCEPTANCE-TESTING.md) for how to try it. The design and roadmap are in
[docs/plans/2026-10-14-feat-interactive-displays-v2-plan.md](docs/plans/2026-10-14-feat-interactive-displays-v2-plan.md);
the v1 code is archived in [legacy/](legacy/README.md).

| LCARS | Holo HUD | Terminal |
|---|---|---|
| ![LCARS weapons control on a 4K panel](docs/showcase/instruments/4k-weapons.png) | ![Weapons control in the Holo HUD](docs/showcase/instruments/4k-weapons-hud.png) | ![The conn on the green-screen terminal](docs/showcase/instruments/4k-conn-crt.png) |
| ![The master systems display with the Norway class ship](docs/showcase/ship/4k-msd.png) | ![The bridge in the Holo HUD on red alert](docs/showcase/phase-6/4k-bridge-hud-red-alert.png) | ![The freighter reactor room on the terminal](docs/showcase/phase-6/4k-freighter-reactor-room.png) |

| Operator console | Screen editor |
|---|---|
| ![The operator console with cues and the Look panel](docs/showcase/phase-6/operator-cues-and-look.png) | ![The editor with a screen built by drag and drop](docs/showcase/layout-dnd/editor-built.png) |

| One button on Tactical… | …replays the viewscreen and, 1.5 s later, moves Engineering |
|---|---|
| ![Tactical with the Photon torpedoes button](docs/showcase/interactions/1-tactical-before.png) | ![Engineering moved to the master systems display](docs/showcase/interactions/4-engineering-damage-view.png) |

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
- A control can act on other displays: navigate them, play a sound or video there, or press one of their controls,
  optionally after a wait, so one tap sets off a beat across the set. The operator's display-buttons switch turns
  this off.
- `/d/<id>?theme=base` or `?variant=nemesis` previews another look on that display only; `/gallery` shows every
  frame, widget and decor piece of a theme.

## Running the show

- **`/operator`** on a phone or tablet: the running order of cues (GO or the space bar runs the next one: state,
  values, screens and videos at once), show states (normal, alerts, damaged) and a blackout panic button, live
  value sliders, the Look (theme, variant, size, sound pack), and every display with a live thumbnail, its screen,
  Identify, Reload, Rename, video transport and a QR code to open it on a tablet.
- **`/builder`** on a laptop: the screen library, one-click Generate from a ship section, and the editor with
  drag-and-drop layout and per-state overrides. Edits are saved as a draft; displays change only
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
