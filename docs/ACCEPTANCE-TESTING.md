# Acceptance testing

Manual checks for each phase of the v2 rebuild. Automated coverage runs in CI (`pnpm test`, `pnpm test:e2e`,
Docker smoke test); these steps are for a person with real displays.

Report problems or ideas as a GitHub issue (label `v2`) or in the project thread, with the display type,
browser, the URL you opened and a photo or screenshot if possible.

## Phase 0: walking skeleton

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
