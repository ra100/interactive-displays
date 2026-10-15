# Acceptance testing

Manual checks for each phase of the v2 rebuild. Automated coverage runs in CI (`pnpm test`, `pnpm test:e2e`,
Docker smoke test); these steps are for a person with real displays.

Report problems or ideas as a GitHub issue (label `v2`) or in the project thread, with the display type,
browser, the URL you opened and a photo or screenshot if possible.

## Phase 1: core model and LCARS

### Setup

Same as Phase 0 below, but start from a **fresh data directory** so the new demo show is seeded
(`docker compose down -v` removes the old volume; from source, delete `data/`). Open
`http://<server>:3010/health`: it should say `"protocol":2` and `"state":"normal"`.

The operator console arrives in Phase 2; until then states and assignments are set with `curl` (or any HTTP
client) against the REST API. Replace `<server>` with the server's address:

```bash
S=http://<server>:3010
curl -X POST $S/api/state -H 'content-type: application/json' -d '{"state":"red-alert"}'
curl -X PUT $S/api/displays/bridge-2 -H 'content-type: application/json' -d '{"name":"Bridge 2","screen":"tactical"}'
curl -X POST $S/api/displays/bridge-2/identify
curl $S/api/show        # displays, what each shows, connected or not, last seen
```

States in the demo show: `normal`, `yellow-alert`, `red-alert`, `damaged`, `blackout`.

### What to test

| # | Step | Expected |
|---|---|---|
| 1 | Open `/d/test` on a TV or monitor | LCARS bridge: a tan elbow sweeping from the top left, five coloured nav blocks with small numbers (Helm, Tactical, Engineering, Science, Comms), "BRIDGE OPERATIONS" top right, ship status readouts, three pill buttons, status line at the bottom |
| 2 | Open `/d/engineering-1`, `/d/tactical-1` and `/d/corridor-1` on three more displays | Main engineering (toolbar of pills), Tactical (capped header and footer, shield readouts on the right), and the "LCARS ACCESS 4774 / PLEASE STAND BY" standby panel |
| 3 | Compare with the pictures in `design/` | The sweep, bars, condensed type and colours read as LCARS; nothing looks like a web page |
| 4 | Set `red-alert` | Every open display turns red within a blink, all at once; frames pulse; the bridge status reads "RED ALERT · ALL HANDS TO BATTLE STATIONS" and the third button says "Stand down" |
| 5 | Set `yellow-alert`, then `damaged` | Yellow: amber tones, shields read "Raised". Damaged: dim brown palette, parts of the screen flicker and the image jitters now and then; hull integrity 64% in red |
| 6 | Set `blackout`, then `normal` | Every display goes black; `normal` brings the screens back instantly |
| 7 | Set `red-alert`, then open a new display at `/d/late-joiner` | It starts in red alert |
| 8 | Restart the server (`docker compose restart`) while in a state other than normal | Displays reconnect in the same state |
| 9 | Assign a display: `PUT /api/displays/<id>` with `{"screen":"tactical"}` (use the id shown on a display opened at `/d`) | That display switches to Tactical straight away; others do not change. `{"screen":null}` sends it back to the bridge |
| 10 | Identify: `POST /api/displays/test/identify` | `/d/test` shows "TEST DISPLAY" in large white letters with a blinking border for five seconds; no other display reacts |
| 11 | Open `/d/test?theme=base` | The same bridge in the plain base theme: same content, no elbows or bars |
| 12 | Open `/d/engineering-1?variant=nemesis` and `/d/tactical-1?variant=picard` | Blue and grey versions of the LCARS look |
| 13 | Open `/gallery` on a laptop | Three frames, each widget in every slot, the four LCARS decor pieces; switching theme, variant and effect updates everything; nothing shows a dashed "invalid" box |
| 14 | Tap every button on a touchscreen | Each brightens while pressed; each is at least a fingertip tall even on a small tablet |
| 15 | Turn a tablet to portrait | The bridge re-flows; narrow buttons become rounded blocks instead of ovals |

### Edge cases worth trying

- Edit `data/shows/demo/screens/bridge.json` with a `when` entry for a state that does not exist, restart, and
  open `GET /api/screens/bridge`: the `lint` list warns about the unknown state; the display still renders.
- Assign a screen that does not exist: the API answers 404 and nothing changes.
- Send two edits with the same `baseRevision` to `POST /api/screens/bridge/ops`: the second gets 409 with the
  current revision.
- Several displays on the same id all follow state changes and identify.

### Known limitations (Phase 1)

- No operator console or editor yet (Phase 2); states, assignments and identify are API calls, screens are
  JSON files or API ops.
- Buttons give touch feedback but do nothing; display actions arrive in Phase 3.
- Readouts are text widgets; live data widgets, signals and bindings arrive in Phase 3.
- No fullscreen, wake lock or hidden cursor yet; use the browser's kiosk mode (Phase 6 polishes this).
- No authentication; run it on a closed set network.

## Phase 0: walking skeleton

These steps describe the Phase 0 build. From Phase 1 on, the seeded demo show is LCARS and `/health` reports
protocol 2, so the welcome screen in steps 2, 9 and 10 is now the bridge (`screens/bridge.json`).

### Setup

Either:

```bash
docker compose up -d --build          # from the repo root
```

or, without Docker:

```bash
pnpm install && pnpm build && pnpm start
```

Find the server's LAN address (for example `192.168.1.20`). All URLs below use `http://<server>:3010`.

### What to test

| # | Step | Expected |
|---|---|---|
| 1 | Open `http://<server>:3010/health` | `{"status":"ok","protocol":1,"show":"demo","displays":0}` |
| 2 | On a display, open `http://<server>:3010/d/test` | The demo screen: a blue title "INTERACTIVE DISPLAYS" with code `00-0001`, a paragraph, three large buttons (Engineering, Tactical, Science) |
| 3 | Reload `/health` | `displays` counts the open displays |
| 4 | Tap each button on a touchscreen | Each brightens and shrinks slightly while pressed; nothing else happens yet (actions arrive in Phase 1) |
| 5 | Open `http://<server>:3010/d` in a fresh browser (or private window) | The address changes to `/d/d-xxxxxx`; reloading `/d` or `/` returns to the same id |
| 6 | Rotate a tablet, or resize the browser window from wide to tall | The screen re-flows; text and buttons scale; nothing overlaps or scrolls |
| 7 | Stop the server (`docker compose stop` or Ctrl+C) | Every display keeps its screen and shows `RECONNECTING` in the bottom-right corner |
| 8 | Start the server again | Within a few seconds the badge disappears on every display without touching them |
| 9 | Edit `data/shows/demo/screens/welcome.json`, for example change the title text, then restart the server. With Docker: `docker compose cp displays:/data/shows/demo/screens/welcome.json .`, edit it, `docker compose cp welcome.json displays:/data/shows/demo/screens/welcome.json`, `docker compose restart` | Displays reconnect and show the edited screen |
| 10 | Break the JSON of that file on purpose and restart | The server still starts; the log says the screen was skipped; displays show "NO SCREEN ASSIGNED" |
| 11 | Open `http://<server>:3010/d/Bridge%201` | "INVALID DISPLAY ID" with a hint about allowed characters |

### Edge cases worth trying

- A display that was off during a server restart: switch it on afterwards; it should load normally.
- Several displays open on the same id: all of them show the same screen.
- Leave a display open for an hour with the server idle: it should still be connected (`/health` counts it).

### Known limitations (Phase 0)

- Only the neutral `base` theme; LCARS arrives in Phase 1.
- Three widgets (title, text, button); buttons give touch feedback but have no actions yet.
- Screens are edited as JSON files and picked up on restart; the editor arrives in Phase 2.
- No operator controls, show states, assignments UI, generation or AI yet (Phases 1–5).
- No authentication; run it on a closed set network.
