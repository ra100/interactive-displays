# Acceptance testing

Manual checks for each phase of the v2 rebuild. Automated coverage runs in CI (`pnpm test`, `pnpm test:e2e`,
Docker smoke test); these steps are for a person with real displays.

Report problems or ideas as a GitHub issue (label `v2`) or in the project thread, with the display type,
browser, the URL you opened and a photo or screenshot if possible.

## Phase 4: one-click generation

### Setup

Any Phase 3 data directory works; nothing new is seeded. A fresh one (`docker compose down -v`; from source,
delete `data/`) gives the demo show's states and signals, which generated screens use for red alert and for the
readings that follow a show value. You need a laptop for `/builder`, one display opened at `/d/<any-name>` and a
phone for `/operator`.

### The Phase 4 exit check

"Choosing Weapons yields a plausible, on-style, touch-safe screen in one click; a reroll differs; locked parts
survive."

| # | Step | Expected |
|---|---|---|
| 1 | In `/builder`, press **Generate**, choose **Tactical** | Three takes appear at once, each on another layout, with a weapons title, nav buttons (Shields, Phasers, Torpedoes…) and panels about shields, phasers, torpedoes or alert status |
| 2 | Press **Create and edit**, then **Publish**; assign the screen to your display in the operator console | The display shows it; every button is comfortably big enough to tap; numbers and gauges move by themselves |
| 3 | Set **Red alert** in the operator console | Shield readings drop to their alert range and turn red, lights flash, a RED ALERT banner appears and the bottom line changes to an alert message |
| 4 | Tap **Red alert**, **Yellow alert** or **Stand down** on the display (if the screen has the Alert status panel) | The whole show changes state |
| 5 | Back in the editor, select the title, tick **Locked**, press **Regenerate** | Everything except the title changes; the layout stays; a message says Undo brings the old screen back |
| 6 | Press **Undo** | The previous screen is back exactly |
| 7 | Select a panel (click a panel heading, then Esc), press **Reroll** | Only that panel changes, in the same place |

### Generate dialog

| Step | Expected |
|---|---|
| Change **Section**, **Density**, **Aspect** | The three takes update at once; dense has more panels and buttons than sparse; 9:16 leads with a stacked layout |
| Type a seed, or press **Roll** | The same seed always gives the same takes; Roll gives new ones |
| Pick a state in the box next to "Pick one" | The takes show how they look in that state |
| Tick **Also make a screen for each system**, create | The overview opens in the editor and the library shows one more screen per system; publish them all, put the overview on a display and tap its nav buttons: they move between the screens, and each system screen has an Overview button |

### Placeholders

1. In the editor, add a **Placeholder** from the Widgets list into the main area, and set its intent to a sentence
   such as "torpedo loading controls".
2. The Checks list says it is still a placeholder.
3. Press **Regenerate**: the placeholder becomes a panel about the matching system (here, the torpedo bays) in the
   same place.

### Edge cases worth trying

- Generate the same section twice: the second gets an id ending in `-2`.
- Lock a whole panel, regenerate several times: it never changes. Lock one widget inside a panel: the widget is kept (as its own panel) and the rest of the panel is regenerated.
- Lock the root (the whole screen): Regenerate leaves it alone.
- Generate in a show without red alert or damaged states: there is no banner and nothing changes per state.
- A screen whose section is not one of the nine (or none) has no Regenerate button.
- Switch the preview theme to Base: generated screens still look sensible.

### Known limitations (Phase 4)

- Generation runs in the browser; the server and MCP get it in Phase 5.
- One content pack (Starship). New sections are JSON files in `packages/content/src/trek/recipes/` and need a
  rebuild; saving recipes from the tools or from AI comes with Phase 5.
- Placeholders match by words, not meaning; AI fills them precisely in Phase 5.
- Danger buttons do not ask for confirmation on displays.
- Regenerating one screen of a suite keeps its nav wired only while the suite's screens keep their generated ids.

## Phase 3: living screens

### Setup

Start from a **fresh data directory** (`docker compose down -v`; from source, delete `data/`) so the demo show
gains its signals, the bound gauges and buttons, and the new Viewscreen screen with its sensor video. A Phase 2
data directory keeps its own show and screens, which have no signals or actions.

`http://<server>:3010/health` should say `"protocol":4`. You need: four displays opened at `/d/test`,
`/d/engineering-1`, `/d/tactical-1` and `/d/viewscreen-1`, a phone for `/operator` and a laptop for `/builder`.

Sound is off by default. To hear it, turn on "Sounds on displays" in the operator console and touch each display
once (browsers only play sound after a touch), or start the kiosk browser with
`--autoplay-policy=no-user-gesture-required`.

### The Phase 3 exit check

"A hand-built engineering screen animates believably, red alert visibly changes it, display buttons do something."

| # | Step | Expected |
|---|---|---|
| 1 | Watch `/d/engineering-1` for half a minute | Core output creeps between about 88 and 99%, the output trace draws a line, the EPS taps change in their decimals, grid load wanders, numbers scroll in the cascade, plasma bars pulse and relay lamps blink, each at its own pace. Nothing jumps or moves in step |
| 2 | Assign Main engineering to `/d/test` in the operator console and put it next to `/d/engineering-1` | Both show the same core output and the same EPS readings at the same moment (as long as both computers set their clocks from the network); assign Show default again afterwards |
| 3 | Set Red alert | Engineering turns red; a flashing RED ALERT banner appears above the core; core output climbs above 100% and the gauge turns to danger past 102; the text says "Core output at 104%" |
| 4 | Set Damaged | Brown palette; HULL BREACH banner; core output sinks to 35–75% and turns danger below 60; relays go red and busy |
| 5 | Set Normal | Everything settles back |

### Buttons on the displays

| # | Step | Expected |
|---|---|---|
| 1 | On `/d/test`, press Red alert | Every display goes red at once; Shields reads 100%; on the bridge, Yellow alert and Red alert disappear and a green Stand down takes their place |
| 2 | Press Stand down | Every display returns to normal; Shields 0% |
| 3 | Press Yellow alert, then Stand down | Amber, shields up; then back |
| 4 | On `/d/test`, press Engineering in the sidebar | That display (only) shows Main engineering; its operator card says "On Main engineering" |
| 5 | Press Diagnostics, then Back | Ship schematic with a Back button; Back returns to Main engineering |
| 6 | In the operator console, press Send back on the test display's card | It returns to the bridge |
| 7 | On `/d/engineering-1`, press Core eject | The show goes to Damaged; hull integrity drops to 61% on the bridge and on the tactical hull gauge |
| 8 | Set Normal, then reset hull with the operator's Hull integrity slider | 100% everywhere |
| 9 | On `/d/tactical-1`, press Raise shields, then Lower | The shield arc fills to 100% and empties, on every display that shows shields |
| 10 | On `/d/viewscreen-1`, press Hold, Play, Replay | The sensor sweep pauses, resumes and starts over, on that display only |
| 11 | Press any button | It flashes, so the camera sees the touch even when it is quick |

### Operator console

| # | Step | Expected |
|---|---|---|
| 1 | Open `/operator` on the phone | Below the states: Live values (Shield strength, Hull integrity, Warp factor with sliders, Warp core output as a moving reading), then Display controls with two switches |
| 2 | Drag Shield strength | The tactical arc and the bridge's Shields follow while you drag; − and + move it by 5 |
| 3 | Move Warp factor | The bridge's Warp factor follows in steps of 0.1 |
| 4 | Open `/operator` on a second phone and move a slider on the first | The second phone's slider follows |
| 5 | Turn off "Display buttons run the show", then press Red alert on `/d/test` | The button flashes but nothing changes; navigation and video buttons still work. Turn it back on |
| 6 | Turn on "Sounds on displays", touch each display once, press buttons | A short chirp per press; Open channel on the bridge plays a hail; Red alert sounds a klaxon on every display, Yellow alert a warning tone |
| 7 | On the Viewscreen card, press Pause, Play, Restart under "Video · feed" | The video on `/d/viewscreen-1` follows |
| 8 | Look at the thumbnails | They show shared values as they change, but stand still otherwise |

### Editor

| # | Step | Expected |
|---|---|---|
| 1 | `/builder`, press Signals | A list of the show's seven signals; selecting one shows its name, id, unit, whether every display shares it, and where its value comes from |
| 2 | Add signal: name "Plasma pressure", id `plasma.pressure`, Wanders from 20 to 80, Its own value; Save signals | Saved; a lowest above the highest, or a repeated id, is explained and cannot be saved |
| 3 | Open Main engineering, select the Core output gauge; under Live value pick Plasma pressure | The preview follows the new signal at once (unpublished: displays keep the old one until Publish) |
| 4 | Pick "Wanders", then change Lowest and Highest | The gauge wanders in that range by itself |
| 5 | Pick "Its own value" | The gauge shows its Value property again |
| 6 | Select a button; under When used, choose each New action and press Add: Go to screen, Change show state, Set a shared value, Play a sound | Each adds a small form; choosing alone adds nothing; choices the show cannot do (a video when the screen has none) are greyed out; Remove takes one away |
| 7 | Open Tactical, select the contacts table | Columns edit one per line, Rows one row per line with cells split by `|` |
| 8 | Point a Go to screen action at a new, empty screen, delete that screen in the library, then reopen this one | Checks warns "There is no screen … to go to" |
| 9 | Publish, then press the button on a display | It does what the actions say |

### Edge cases worth trying

- Restart the server: Shield strength, Hull integrity and Warp factor keep the values the crew set; displays that
  buttons had moved go back to their assigned screens.
- Press a button just as the state changes and it disappears: a press on a hidden button is ignored.
- In the editor, add a Slider to a screen, bind its Value to Shield strength and give it "Set a shared value" (to this
  control's value); publish. Drag it on a display and hold: the thumb stays under the finger, every other display
  follows, and with sounds on it chirps once where you let go. With display buttons switched off, the slider moves
  back to the show's value a moment after you let go.
- With sounds on, change states before anyone has touched a display: those alarms are skipped, not saved up and
  played together at the first touch. A display that was offline during a state change does not sound it late.
- Upload an H.264 MP4 and play it on a display running open-source Chromium: it stays black. Use WebM (VP9), which
  every display browser plays, or Google Chrome.
- Edit the show's signals while displays are on: they pick up the change at once, keeping the values of signals
  that still exist.

### Known limitations (Phase 3)

- Per-state signal ranges (`byState`) are edited in `show.json` with the server stopped (the server reads the file
  only at start and rewrites it on every change made in the tools); the signals dialog keeps them as they are.
- No countdown clock, video seek, cue lists or local toggles yet (see
  `docs/deviations/2026-10-15-phase-3-living-screens.md`).
- Where a display's buttons took it is forgotten when the server restarts.
- Sounds are simple synthesised tones; recorded sound packs come with Phase 6.

## Phase 2: editor and operator console

### Setup

Start from a **fresh data directory** so the demo show gains the Ship schematic screen and its image
(`docker compose down -v`; from source, delete `data/`). A Phase 1 data directory also works: its screens are
upgraded on load and stay on air, it just lacks the new screen.

Optional, in a `.env` file next to `docker-compose.yml` (or as environment variables):

```bash
EDITOR_TOKEN=pick-a-long-secret        # protects /operator, /builder and every change; displays never need it
PUBLIC_URL=http://192.168.1.20:3010    # the address tablets use, for QR codes (default: the browser's address)
```

`http://<server>:3010/health` should say `"protocol":3`. You need: two or three displays opened at `/d/test`,
`/d/engineering-1` and `/d/tactical-1`, a phone or tablet for `/operator`, and a laptop for `/builder`.

### Five-minute crew training (the Phase 2 exit check)

Give a crew member who has not seen the system the phone with `http://<server>:3010/operator` open and say, in
about five minutes:

1. "The big buttons at the top set the look of every screen at once: Normal, Yellow alert, Red alert, Damaged.
   Try Red alert, then Normal."
2. "Blackout is the panic button: every screen goes black. Press it again (it now says End blackout) to bring them
   back."
3. "Below is one card per display. Green dot means it is on. The picture is what it shows right now."
4. "To change what a display shows, pick a screen in its Screen box. 'Show default' gives it the standard screen."
5. "Not sure which physical screen is which? Press Identify: that screen flashes its name for five seconds."
6. "Reload fixes a display that looks stuck. QR shows a code to open that display on a tablet; Add a display shows
   the code for a brand-new one."

Then, without help, ask them to:

| # | Task | Pass when |
|---|---|---|
| 1 | "Put the ship in yellow alert" | Every display turns amber |
| 2 | "Find the Engineering 1 display in the room" | They use Identify and point at the right screen |
| 3 | "Show Tactical on the test display" | `/d/test` switches to Tactical; nothing else changes |
| 4 | "Black everything out, then bring it back in red alert" | Blackout, then Red alert (or End blackout, then Red alert) |
| 5 | "Put the test display back to normal" | Screen box back to Show default, state Normal |
| 6 | "Add this tablet as a new display" (hand them a second tablet) | They scan the Add a display QR code; the tablet appears in the list and they assign it a screen |

Note anything they hesitate over; that is the feedback this phase needs.

### Operator console (`/operator`)

| # | Step | Expected |
|---|---|---|
| 1 | Open `/operator` on a phone | Two columns of state buttons, a full-width Blackout, then the display cards; nothing needs zooming; every button is at least a fingertip tall |
| 2 | Open it on a tablet in landscape | States on the left, display cards in two columns on the right |
| 3 | Press each state | Every display follows within a blink; the pressed button stays highlighted; the thumbnails recolour too |
| 4 | Press Blackout, then End blackout | Displays go black, then return to Normal |
| 5 | Change a display's Screen | That display switches at once; its thumbnail updates |
| 6 | Rename a display ("Bridge left") | The new name shows on the card, in Identify, and in the editor's Send to display list |
| 7 | Close a display's browser tab | Its dot turns grey and the card says "seen … ago"; Identify and Reload are disabled; Forget removes it |
| 8 | Reload a display | It reloads itself and comes back on the same screen |
| 9 | QR on a card; scan it with a tablet | The tablet opens that display's address (with `PUBLIC_URL` set, that address) |
| 10 | Open `/operator` on a second phone and change the state on the first | The second phone updates within a second |
| 11 | Stop the server for a few seconds | The Live chip turns into Offline; buttons do nothing harmful; it reconnects on its own |

### Screen library and editor (`/builder`)

| # | Step | Expected |
|---|---|---|
| 1 | Open `/builder` on a laptop | Cards for Bridge operations, Main engineering, Ship schematic, Standby and Tactical, each with a thumbnail, "Published" and "On 1 display" where it applies |
| 2 | Type `eng` in the search box | Only Main engineering and the screens with engineering as section remain |
| 3 | New screen: name "Warp core", section "engineering", template Header and main, Create and edit | The editor opens a LCARS screen with a title, three toolbar pills and a main area; the library shows it as Never published |
| 4 | In the editor, click a button in the preview, change its Label | The preview changes as you type; the top bar says Saving…, then Saved |
| 5 | Pick a tone swatch, then press Undo and Redo (or Ctrl+Z, Ctrl+Shift+Z) | The colour reverts and comes back |
| 6 | Drag a widget from the Widgets tab into the outline, between two rows | It lands there; the inspector shows it |
| 7 | Drag a row in the outline to another place, or another slot | It moves; the preview re-flows |
| 8 | Select a node, press Delete, then Ctrl+Z | It disappears and comes back |
| 9 | Select a button, Ctrl+D, then Alt+↑ | A copy appears and moves up one place |
| 10 | Switch the preview between 16:9, 4:3 and 9:16, between LCARS and Base, and through the states | The preview matches what a display of that shape shows in that theme and state |
| 11 | With State set to Red alert, select a text, choose "Only in Red alert", change the text | Normal still shows the old text; Red alert shows the new one; the outline marks it with ⚡; "Changes per state" lists it with Clear |
| 12 | Check Locked on a node | The outline shows a lock; locks matter for the generator and AI in later phases |
| 13 | Screen tab: change the name and section | The library card follows |
| 14 | Open Standby (a canvas): drag the text box in the preview, then drag a corner | It moves and resizes in steps; arrow keys nudge it by 1%, Shift+arrow by 5% |
| 15 | Assets tab: Upload files, pick a PNG or JPG | It appears in the list; Add puts an image widget with it on the screen |
| 16 | Open Bridge operations, make a change, look at a display showing the bridge | The display does **not** change yet; the top bar says Unpublished changes |
| 17 | Press Publish | A dialog names the displays it goes on air on; after Publish they switch at once |
| 18 | History tab: View an older revision, then Restore it | The preview shows the old version read-only; Restore makes it the current draft as a new revision; publish it to put it on air |
| 19 | Send to display: Preview here on the test display, then edit | `/d/test` shows the draft with a DRAFT PREVIEW badge and follows every edit; the operator card says Draft preview; End preview puts it back |
| 20 | Turn on Live edit (confirm "Go live") and change something | It goes on air without Publish; the Publish button is gone. Turn it off again before a take |
| 21 | Open the same screen on two laptops and edit on one | The other editor shows the change within a second |
| 22 | Checks (bottom right) | "All good" for the demo screens; an empty stack or a very long button label shows a warning you can click to select the node |
| 23 | Library: Delete on a screen a display uses | Disabled, with a tooltip saying why; on an unused screen it asks first, then removes it |

### Editor token

Restart the server with `EDITOR_TOKEN` set, then:

| # | Step | Expected |
|---|---|---|
| 1 | Open `/operator` in a fresh browser | It asks for the editor token; a wrong one says "That token was not accepted"; the right one opens the console and is remembered in that browser |
| 2 | Open `/operator?token=<token>` on another device | It opens straight away and the token disappears from the address bar |
| 3 | Open `/d/test` | Displays need no token |
| 4 | `curl -X POST http://<server>:3010/api/state -H 'content-type: application/json' -d '{"state":"red-alert"}'` | `401`; with `-H 'authorization: Bearer <token>'` it works |

### Edge cases worth trying

- Pull the laptop's network while editing: the top bar says "Offline, retrying"; edits made meanwhile are saved
  once it is back.
- Delete a screen in one tab while it is open in another: the editor says "This screen was deleted".
- Upload a file with spaces and capitals in its name: it is renamed to a safe name (`Warp Core.PNG` →
  `warp-core.png`).
- Select a slot row in the outline (TITLE, NAV, MAIN …) and click a widget in the Add panel: it goes into that slot.
- Restart the server with a draft that differs from the published copy: displays keep the published copy, the
  editor keeps the draft.

### Known limitations (Phase 2)

- No video widget, video transport or signal sliders on the operator console yet; they come with Phase 3's
  living screens (see `docs/deviations/2026-10-15-phase-2-editor-operator.md`).
- Draft previews last until ended or until the server restarts.
- With `EDITOR_TOKEN`, reading the show and screens stays open on the network (displays need it); only changes
  are protected. There is no audit log yet (Phase 5).
- No generator or AI yet (Phases 4 and 5); new screens start from five fixed layouts.
- One show; switching between shows comes later.

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
| 1 | Open `/d/test` on a TV or monitor | LCARS bridge: a tan elbow sweeping from the top left, five coloured nav blocks with small numbers (Helm, Tactical, Engineering, Science, Comms), "BRIDGE OPERATIONS" top right, ship status readouts, four pill buttons, status line at the bottom |
| 2 | Open `/d/engineering-1`, `/d/tactical-1` and `/d/corridor-1` on three more displays | Main engineering (toolbar of pills), Tactical (capped header and footer, shield readouts on the right), and the "LCARS ACCESS 4774 / PLEASE STAND BY" standby panel |
| 3 | Compare with the pictures in `design/` | The sweep, bars, condensed type and colours read as LCARS; nothing looks like a web page |
| 4 | Set `red-alert` | Every open display turns red within a blink, all at once; frames pulse; the bridge status reads "RED ALERT · ALL HANDS TO BATTLE STATIONS" and the third button says "Stand down" |
| 5 | Set `yellow-alert`, then `damaged` | Yellow: amber tones across the screen. Damaged: dim brown palette, parts of the screen flicker and the image jitters now and then; the hull integrity reading turns red |
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
