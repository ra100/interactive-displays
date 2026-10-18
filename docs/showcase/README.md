# Showcase

What each phase of the v2 rebuild looks like. Screenshots are captured by `tests/e2e/showcase.spec.ts`
against the real server and built app (`pnpm build && SHOWCASE=phase-N pnpm test:e2e showcase`).

## Video tour

<a href="video/showcase.mp4"><img src="video/teaser.webp" alt="The video tour at 4× speed" width="720" /></a>

[**showcase.mp4**](video/showcase.mp4) (4 minutes, 1080p): the consoles of the demo show in LCARS, the show
states from yellow alert to a hull breach, the ship schematic, every LCARS era and the Holo HUD and Terminal
looks, the operator console running cues with a display live in the corner, one button on Tactical playing out
on the viewscreen and engineering side by side (and its Runs on and Wait settings in the editor), and the editor
changing a widget, publishing it and generating screens. Everything in it is the real app, recorded from a fresh demo show:

```bash
pnpm build && SHOWCASE=video pnpm test:e2e video   # needs ffmpeg with libx264
```

The looping preview above (`video/teaser.webp`, 4× speed) is cut from it:

```bash
ffmpeg -ss 4 -t 235 -i docs/showcase/video/showcase.mp4 -vf "setpts=PTS/4,fps=10,scale=720:-1:flags=lanczos" \
  -c:v libwebp_anim -loop 0 -quality 55 -compression_level 6 docs/showcase/video/teaser.webp
```

The recording (`tests/e2e/video.spec.ts`) runs its own server, drives the app through a director page
(`tests/e2e/support/director.html`: the app in a frame, a live display picture-in-picture or three displays side
by side, captions and fades) and
encodes Chrome's screencast frames at their real times into a 30 fps H.264 video.

## Scripted interactions between displays

A control on one display can now act on others. Navigate, back, video and sound actions say **where they run**:
this display (as before), every other display, every display, or the displays and screens chosen ("any display
showing Viewscreen"). A new **Use a control on another display** action presses a control over there: it flashes
as if touched and runs its own actions on that display, so a button can set off a whole beat across the set.
Any action can **wait** a number of seconds first, so the beat plays out: tap here, and a moment later the other
screen reacts. `SHOWCASE=interactions pnpm test:e2e showcase` captures these.

**One button, three displays.** The demo's **Photon torpedoes** button on Tactical confirms with a beep, uses
the viewscreen's own **Replay** button (it flashes and the sensor feed starts again), and 1.5 seconds later sounds
the alert on every display showing Main engineering and takes them to the master systems display.

| Tactical: Photon torpedoes | Engineering before |
|---|---|
| ![Tactical with the Photon torpedoes button](interactions/1-tactical-before.png) | ![Main engineering before the beat](interactions/2-engineering-before.png) |

| Viewscreen: Replay used from Tactical | Engineering 1.5 s later |
|---|---|
| ![The viewscreen's Replay button flashing](interactions/3-viewscreen-replayed.png) | ![Engineering moved to the master systems display](interactions/4-engineering-damage-view.png) |

**In the editor.** Each action has **Runs on** and **Wait (seconds)**. Choosing displays and screens shows them
as checklists with a one-line summary; a trigger lists the controls with actions on the screens it reaches.

| The trigger | The delayed actions |
|---|---|
| ![Editor: Use a control on another display](interactions/editor-torpedoes.png) | ![Editor: delayed navigate on chosen screens](interactions/editor-delayed.png) |

### Under the hood

- Actions gain `on` (`self`, `others`, `all` or `{ displays, screens }`) on navigate, back, video, sound and the
  new `trigger { target, on }`, and `after` (0–600 s) on every action. Old screens are unchanged: no `on` means
  this display, no `after` means at once.
- The display still plays its own undelayed sounds and videos; everything else goes to the server in the same
  `press`. The server works out the target displays, navigates them, sends `sound` and `video` to them, and for a
  trigger sends `trigger { nodeId }` (the display flashes the control and runs its local actions) and runs the
  control's other actions as if pressed there. Protocol version 5.
- Reaching another display counts as show-wide, so the operator's display-buttons switch stops it. Triggers nest
  three deep, so two controls that trigger each other stop. Delayed actions live in the server's memory (at most
  64 waiting) and are dropped when the cues go back to the top or the server stops.
- Lint checks what one screen can: screens named in `on` exist, and a trigger on this display names a control
  here. MCP clients get the same actions; the guide explains them.

## Ship schematic: the Norway class from its model

A new **ship schematic** element draws a real ship, traced from the Norway class Blender model: from above,
the side or the front, or turning in three dimensions as a holographic lines plan. A mode says what the drawing
is for. **Tactical** draws the shield bubble (it thins and turns amber, then red, as shields fall) and lights
the phaser arrays and torpedo launcher when weapons are armed. **Engineering** shows the warp core breathing and
power flowing along the conduits to the nacelles, impulse engines and deflector, faster with more power, with
deck lines. **Damage control** blinks damaged systems and darkens offline ones. Systems the screen marks are
picked out in every mode, and labels hang off leaders in bands above and below the ship. The drawing sweeps in
once behind a scan line when the screen appears; in a box taller than wide the dorsal view stands bow up.
`SHOWCASE=ship pnpm test:e2e showcase` captures these (4K shots at the show's 70% scale, 256 colours).

**Master systems display.** The demo's ship schematic screen: the port profile with power distribution, the
dorsal tactical view following the `shields` signal, the forward view with the deflector marked and the ship
turning in the side panel. Red alert arms the weapons; the damaged state turns every view to damage control.

| Master systems display | Red alert |
|---|---|
| ![Master systems display](ship/4k-msd.png) | ![Master systems display on red alert](ship/4k-msd-red-alert.png) |

**Tactical.** The tactical screen plots the ship beside its weapon controls.

| Tactical | Red alert |
|---|---|
| ![Tactical plot](ship/4k-tactical.png) | ![Tactical plot on red alert](ship/4k-tactical-red-alert.png) |

**Every view and mode**, and the same in the other looks:

| LCARS | Holo HUD | Terminal |
|---|---|---|
| ![Views in LCARS](ship/views.png) | ![Views in the HUD](ship/views-hud.png) | ![Views on the terminal](ship/views-crt.png) |

**Bow up in tall boxes**, and the turning view a few seconds apart:

![Dorsal views bow up](ship/bow-up.png)

| | | | |
|---|---|---|---|
| ![](ship/turn-0.png) | ![](ship/turn-1.png) | ![](ship/turn-2.png) | ![](ship/turn-3.png) |

**The other looks.** The master systems display in the Holo HUD (glowing glass) and on the terminal (vector
strokes only):

| Holo HUD | Terminal |
|---|---|
| ![Master systems display in the HUD](ship/4k-msd-hud.png) | ![Master systems display on the terminal](ship/4k-msd-crt.png) |

### Under the hood

- `tools/ships/` traces the model once, offline, with Blender as a Python module: Freestyle line art for each
  view, outlines from the render's alpha, each system's outline, label anchor and whether the hull hides it,
  windows, deck lines, and a lines plan cut through the solid that depth maps along three axes enclose. The
  result is `packages/themes/src/ships/norway.json`, in metres, checked against a Zod schema when it loads.
- The renderer is one SVG per view. Labels are sized from the text around them, spread so they never overlap,
  and the least important are dropped when a band is full. The turning view projects about 1,700 points at 20
  frames a second; displays that agree on the time agree on the angle.
- Generated screens get it too: tactical ones follow the shields and arm in an alert, engineering ones follow
  the core's power.
- Adding a ship: see the `ships` skill (`.claude/skills/ships/SKILL.md`).

## Instruments and panels

Eleven new elements for scans, graphs, tactical and navigation stations, and a nested **panel** layout so the
LCARS sweeps, bars and brackets run through the screen and divide it into sections instead of only framing its
edge (the way mewho.com's Project RITOS and Titan.DS screens flow). Sources are in
[`docs/reference/lcars.md`](../reference/lcars.md). Display shots are full 3840×2160 captures at 70% size
(reduced to 256 colours); `SHOWCASE=instruments pnpm test:e2e showcase` captures them.

**New elements.** *Scans and graphs*: waveform (sine, pulse, noise or heartbeat traces), spectrum analyser,
planet scan, scan progress. *Tactical*: shield status by facing, weapon banks and torpedo tubes, targeting
scanner. *Navigation*: heading (tape or compass rose), warp/speed ladder, star chart with the plotted course and
the ship on it, and the reactor core column. Each is one catalog widget with live bindings, so values walk on
their own or follow show signals, and each changes with the show's state (shields drop, banks arm, the target
locks on red alert).

| Weapons control | Red alert |
|---|---|
| ![Weapons control](instruments/4k-weapons.png) | ![Weapons control on red alert](instruments/4k-weapons-red-alert.png) |

| Helm (conn) | Astrometrics |
|---|---|
| ![Conn](instruments/4k-conn.png) | ![Astrometrics](instruments/4k-astrometrics.png) |

**Panels.** A `panel` is a small frame with a title, main and status slot that sits inside another layout. In
LCARS it draws one of eight shapes (sweep, sweep right, top, top right, bottom, bottom right, bracket, rails)
with tone blocks and reference numbers; the Inspector's **Shape** picks one, or the node id picks one for you.
The generator uses them through new blocks, so generated screens get them too.

**The other looks.** The same screens re-skin with no changes: the HUD draws panels as glass cards with
corner ticks and glowing traces; the terminal draws them as boxes with the title cut into the top rule.

| Holo HUD | Holo HUD |
|---|---|
| ![Weapons in the HUD](instruments/4k-weapons-hud.png) | ![Astrometrics in the HUD](instruments/4k-astrometrics-hud.png) |

| Terminal | Terminal |
|---|---|
| ![Conn on the terminal](instruments/4k-conn-crt.png) | ![Weapons on the terminal](instruments/4k-weapons-crt.png) |

**Gallery.** Every new element in every slot, in each theme (`/gallery?theme=<id>`).

| | LCARS | HUD | Terminal |
|---|---|---|---|
| Shields | ![](instruments/gallery-lcars-shield-status.png) | ![](instruments/gallery-hud-shield-status.png) | ![](instruments/gallery-crt-shield-status.png) |
| Weapons | ![](instruments/gallery-lcars-weapon-banks.png) | ![](instruments/gallery-hud-weapon-banks.png) | ![](instruments/gallery-crt-weapon-banks.png) |
| Star chart | ![](instruments/gallery-lcars-star-chart.png) | ![](instruments/gallery-hud-star-chart.png) | ![](instruments/gallery-crt-star-chart.png) |
| Waveform | ![](instruments/gallery-lcars-waveform.png) | ![](instruments/gallery-hud-waveform.png) | ![](instruments/gallery-crt-waveform.png) |

## Portrait displays rearrange the screen

Turn a panel from landscape to portrait (or show a 16:9 screen on a tall display) and the screen is rebuilt for
the new shape instead of stretched. Every frame has a portrait form in every look: the nav column becomes a band of
buttons under the title, side panels move below the main area, rows of panels stack into columns and grids turn
on their side. The rules are automatic; the editor lets you keep a part as designed, force it into a row or a
column, or hide it on the turned display, and a screen can switch rearranging off. Each pair below is the same
published screen at 3840×2160 and 2160×3840.

| Bridge (sidebar) | | Tactical (dashboard) | |
|---|---|---|---|
| ![Bridge landscape](portrait/bridge-sidebar-landscape.png) | ![Bridge portrait](portrait/bridge-sidebar-portrait.png) | ![Tactical landscape](portrait/tactical-dashboard-landscape.png) | ![Tactical portrait](portrait/tactical-dashboard-portrait.png) |

| Operations (console) | | Sensors (split) | |
|---|---|---|---|
| ![Operations landscape](portrait/operations-console-landscape.png) | ![Operations portrait](portrait/operations-console-portrait.png) | ![Sensors landscape](portrait/sensors-split-landscape.png) | ![Sensors portrait](portrait/sensors-split-portrait.png) |

**What moves.** On the bridge the nav blocks become a band under the title and the sweep slims to a bracket. On
tactical the shields panel drops below weapons behind a horizontal divider and lays its gauges side by side under
its heading. Operations moves its sensor net to the bottom. Engineering's grid turns, so the EPS column becomes a
band along the bottom.

| Engineering (header and main) | | HUD | | Terminal | |
|---|---|---|---|---|---|
| ![Engineering landscape](portrait/engineering-header-main-landscape.png) | ![Engineering portrait](portrait/engineering-header-main-portrait.png) | ![HUD landscape](portrait/operations-hud-landscape.png) | ![HUD portrait](portrait/operations-hud-portrait.png) | ![Terminal landscape](portrait/sensors-crt-landscape.png) | ![Terminal portrait](portrait/sensors-crt-portrait.png) |

**In the editor.** Press **9:16** above the preview to see a landscape screen turned. A note says it is
rearranged; select any part and choose its **Arrangement** (rearrange automatically, keep as designed, row,
column) or **Hidden on a portrait display** in the inspector. Moving and resizing stays in the screen's own shape.

![Editor previewing a turned screen](portrait/editor-turned-preview.png)

### Under the hood

- `turnTree(root, from, to)` in `core/tree/turn.ts` is pure and deterministic; the display, the preview and the
  tests all call it. Same orientation in and out gives back the very same tree.
- Frames get `data-orientation`; themes style `.frame[data-orientation="portrait"] > …`. LCARS adds a portrait arm
  that continues the bracket beside the nav band.
- Documents: `profile.rearrange` and a node's `turned: { arrange, hidden }`, set with the `set` op. See
  `docs/deviations/2026-10-16-portrait-rearrange.md`.

## Drag-and-drop layout in the editor

Layouts are now set up in the preview itself, with the mouse: drag parts in from the Add panel, move them by
dragging their selection, drag the edges between parts to change widths, drag grid lines and grid cell edges,
and use the quick buttons on the selection for the common layout steps. Every drag is one edit, so Undo takes it
back. Editor shots are 1920×1080 at 2× (3840×2160 images); the display shot is a full 4K capture.

**Drop where it goes.** While dragging over the preview, a dashed outline shows the container it will land in and
an orange mark shows the spot: a line between parts, a grid cell, or a point on a canvas. Empty frame slots are
drawn in the editor so there is somewhere to drop. Near the edge of a container the drop goes next to it rather
than into it.

| Into an empty slot | Into a grid cell |
|---|---|
| ![Dropping a button into the empty nav slot](layout-dnd/drop-into-empty-slot.png) | ![Dropping a bar graph into a grid cell](layout-dnd/drop-into-grid-cell.png) |

**Resize by dragging.** The orange bars between the selected part and its neighbours change how the room is
shared; a selected grid shows its column and row lines; the blue tabs on a grid part's right and bottom edges
change how many cells it spans. A chip shows the new value while dragging.

| Grid lines and quick buttons | Dragging a column line | Spanning two rows |
|---|---|---|
| ![Grid handles and tools](layout-dnd/grid-handles-and-tools.png) | ![Column drag](layout-dnd/grid-column-drag.png) | ![Span drag](layout-dnd/grid-span-drag.png) |

| Sharing room between two buttons | Moving a button in the preview |
|---|---|
| ![Share drag](layout-dnd/share-drag.png) | ![Moving a part](layout-dnd/move-in-preview.png) |

**Quick buttons** on the selection: **+ Copy**, **In row** and **In column** (put the part in a new row or column
so something can go beside it), **To row / To column** for a stack, **+ Col, − Col, + Row, − Row** for a grid,
and **Delete**.

| Quick buttons | Built from an empty frame | On a 4K display |
|---|---|---|
| ![Selection tools](layout-dnd/selection-tools.png) | ![Finished in the editor](layout-dnd/editor-built.png) | ![Cargo bay on a 4K display](layout-dnd/4k-cargo-bay.png) |
## LCARS references and real button sizes

More of LCARS, taken from the shows and from LCARS builds that catalogue them (sources and the element
inventory are in [`docs/reference/lcars.md`](../reference/lcars.md)), and buttons that are 1 to 2 cm tall on the
set's 80–100" 4K panels. Every display shot is a full 3840×2160 capture at the default 70% size and 1.5 cm buttons
(reduced to 256 colours).

**Buttons at their real size.** The show knows its panels' diagonal (90" by default, a display can have its own)
and draws buttons 1.5 cm tall on them: about 29 px on a 4K panel. Left at 90", the same pixels are 1.33 cm on an
80" panel and 1.67 cm on a 100" one. Before, these buttons came out 113 to 212 px, 5 to 12 cm.

| Before | After |
|---|---|
| ![Bridge before](lcars-references/4k-bridge-before.png) | ![Bridge with 1.5 cm buttons](lcars-references/4k-bridge.png) |

**Two new layouts.** *Console* (Voyager and later): the sweep and navigation column, a row of tools, and a side
panel behind a capped divider. *Split frame* (TNG Engineering): an upper frame that sweeps down into a segmented
bar, a gap, and a lower frame that sweeps up into the navigation column. Both are dense on purpose, the way the
panels on set were; they use the new **segments** and **sensor scope** decor and the status matrix drawn as lamp
rows.

| Operations (console) | Long range sensors (split frame) |
|---|---|
| ![Operations console](lcars-references/4k-operations-console.png) | ![Long range sensors](lcars-references/4k-sensors-split.png) |

**Era palettes**: Deep Space Nine, Voyager and Lower Decks join Nemesis blue and Picard grey.

| Deep Space Nine | Voyager | Lower Decks |
|---|---|---|
| ![DS9](lcars-references/4k-operations-ds9.png) | ![Voyager](lcars-references/4k-sensors-voyager.png) | ![Lower Decks](lcars-references/4k-operations-lower-decks.png) |

**States, size, and the other looks.** The new layouts restyle for red alert, balance well at 50% size, and are
drawn natively by the HUD and the terminal (segments become a scale or a rule, the scope a reticle or a radar).

| Red alert | 50% size | Holo HUD | Terminal |
|---|---|---|---|
| ![Red alert](lcars-references/4k-operations-red-alert.png) | ![50%](lcars-references/4k-operations-scale-50.png) | ![HUD](lcars-references/4k-operations-hud.png) | ![CRT](lcars-references/4k-sensors-crt.png) |

**Gallery and operator.** All five LCARS frames and six decor pieces, and the new **Panel** and **Buttons**
pickers in the operator's Look section.

| Frames | Decor | Look |
|---|---|---|
| ![Frames](lcars-references/gallery-frames.png) | ![Decor](lcars-references/gallery-decor.png) | ![Panel and button pickers](lcars-references/operator-panel-size.png) |

## Phase 6: a second look and show tooling

The same show now runs in three completely different looks: **LCARS**, **Holo HUD** (the translucent HUD chosen
for this phase) and **Terminal** (a green-phosphor CRT, built while the choice was open and kept as a third look).
Each theme has its own frames, widget renderers, decor, sounds and a content pack written for it. Screens are
sized for the set's 4K panels of 80 to 100 inches, and the operator runs scenes from a cue list with one GO button.

Every display shot below is a full 3840×2160 capture (reduced to 256 colours to keep the repository small).

**One show, three looks.** The same bridge screen document, re-skinned from the operator's Look section. The LCARS
bar in the screen is drawn by each theme's stand-in: a tick scale in the HUD, a double rule on the terminal.

| LCARS | Holo HUD | Terminal (amber) |
|---|---|---|
| ![LCARS bridge at 4K](phase-6/4k-bridge-lcars.png) | ![HUD bridge at 4K](phase-6/4k-bridge-hud.png) | ![CRT bridge at 4K](phase-6/4k-bridge-crt-amber.png) |

**Sized for large panels.** Shows draw at 70% by default. The operator can change the size for the whole show
or for one display, and the editor can size one part on its own. Buttons keep a button's height instead of
filling their whole row.

| 50% | 70% (default) | 100% |
|---|---|---|
| ![HUD at 50%](phase-6/4k-bridge-hud-scale-50.png) | ![HUD at 70%](phase-6/4k-bridge-hud.png) | ![HUD at 100%](phase-6/4k-bridge-hud-scale-100.png) |

**States restyle in every look.**

| HUD red alert | Terminal hull breach |
|---|---|
| ![HUD red alert](phase-6/4k-bridge-hud-red-alert.png) | ![CRT damaged](phase-6/4k-bridge-crt-damaged.png) |

**Generated screens that look designed for their theme.** The Generate dialog lists the pack written for the
show's theme first: a patrol corvette for the HUD and a deep-space freighter for the terminal.

| Corvette cockpit | Corvette weapons | Corvette sensors |
|---|---|---|
| ![Cockpit](phase-6/4k-corvette-cockpit.png) | ![Weapons](phase-6/4k-corvette-weapons.png) | ![Sensors](phase-6/4k-corvette-sensors.png) |

| Freighter reactor room | Freighter airlock |
|---|---|
| ![Reactor room](phase-6/4k-freighter-reactor-room.png) | ![Airlock](phase-6/4k-freighter-airlock.png) |

**Cues.** A running order of beats; each cue sets the state, shared values, display screens and videos at once.
**GO** (or the space bar) runs the next one, any cue can run out of order, and **Record what is on air** turns a
rehearsed beat into a new cue. Display buttons can run a cue too. The Look section picks theme, variant, size
and sound pack.

| Operator console | On a phone |
|---|---|
| ![Operator with cues and look](phase-6/operator-cues-and-look.png) | ![Operator on a phone](phase-6/operator-cues-phone.png) |

**One part at its own size** (the readouts grid at 60%), and the new themes in the gallery.

| Editor | HUD gallery | Terminal gallery |
|---|---|---|
| ![Part size in the editor](phase-6/editor-part-size.png) | ![HUD gallery](phase-6/gallery-hud.png) | ![CRT gallery](phase-6/gallery-crt.png) |

### Under the hood

- Theme packs: [`themes/src/hud/`](../../packages/themes/src/hud/) and [`themes/src/crt/`](../../packages/themes/src/crt/).
  A manifest's `decorStandIns` maps another theme's decor to its own (`lcars.bar` → `hud.scale`), so re-skinning
  never leaves holes; `resolveDecor` picks the piece at render time.
- Content packs carry the theme they were written for: [`content/src/corvette/`](../../packages/content/src/corvette/)
  (HUD) and [`content/src/freighter/`](../../packages/content/src/freighter/) (CRT).
- Size: `show.scale` (default 0.7), `display.scale` and a node's `scale` multiply the screen unit `--u`; thumbnails
  and previews use the same scale, so they match the panel.
- Cues: `show.cues`, run by [`showService.ts`](../../packages/server/src/showService.ts) (`runCue`, `go`); REST
  `PUT /api/show/cues` and `POST /api/cues/go|reset|:id/run`; MCP `set_cues` and gated `run_cue`; the last cue run
  survives a restart.
- Sound packs: `show.soundPack` plays another theme's sounds. Kiosk: a web app manifest (fullscreen, opens on its
  own display), a screen wake lock, cursor hiding, no long-press menu, `F` and `?fullscreen` for fullscreen.
- Tests: [`tests/e2e/show-tools.spec.ts`](../../tests/e2e/show-tools.spec.ts) plus unit and integration tests in each
  package.

## Phase 5: AI and MCP

AI works on screens through the same command layer as people: an MCP client (Claude Desktop, Claude Code or any
other) connects to `/mcp`, and the editor has its own **Fill with AI** when the server has an API key. Drafts are
validated like any edit, locked parts are never touched, and nothing goes on air until the operator allows it.

**An MCP client designs while the editor watches.** The client generated a Tactical screen, then renamed it with
`apply_ops`; the open editor shows the change without a reload. Once published (after the operator allowed it),
it runs on a display like any other screen.

| Editor, live | On a display |
|---|---|
| ![MCP edit appearing in the editor](phase-5/editor-mcp-live.png) | ![MCP-generated tactical screen](phase-5/display-mcp-tactical.png) |

**The operator keeps AI off the air.** Two switches in `/operator`: **AI may publish** and **AI may run the show**
(assign screens, change state, signals and videos). Both are off until someone turns them on.

![AI switches in the operator console](phase-5/operator-ai-switches.png)

**AI can add new sections.** The client wrote a "Shuttle bay" recipe (systems, readings with alert ranges, buttons,
nav labels) with `save_recipe`, then generated a screen from it. Red alert works with no extra work because the
recipe gave alert ranges.

| Shuttle bay | In red alert |
|---|---|
| ![Shuttle bay from an AI-written recipe](phase-5/display-mcp-shuttle-bay.png) | ![Shuttle bay in red alert](phase-5/display-mcp-shuttle-bay-red-alert.png) |

**Fill with AI in the editor.** Describe the change, look at the proposal, apply it as one undoable edit or discard
it. These screenshots use a stand-in for the Messages API (the same one the e2e test uses), so they show the flow
rather than a real model's answer.

| Brief | Proposal | Applied |
|---|---|---|
| ![Fill with AI brief](phase-5/fill-brief.png) | ![Fill with AI proposal](phase-5/fill-proposal.png) | ![Fill with AI applied](phase-5/fill-applied.png) |

### Under the hood

- `/mcp` is the official MCP TypeScript SDK over Streamable HTTP, stateless, behind the editor token. Twenty tools
  (discover, generate, edit, check, library, and five gated live tools), four resources (design guide, catalog,
  recipes, screens) and three prompts (design a screen, fill placeholders, new section recipe).
- Every tool calls the same `showService` and `generation` functions as REST, so validation, revisions, locks and
  broadcasts are identical. `apply_ops` and `regenerate` always respect locks.
- Generation now also runs on the server, from the built-in packs plus the show's own recipes and blocks
  (`shows/<id>/content/`).
- Fill with AI runs the Anthropic tool runner on a copy of the screen (`look`, `get_node`, `get_widget`,
  `apply_ops`) and returns ops; the editor applies them through its normal session.
- Code: [`server/src/mcp/`](../../packages/server/src/mcp/),
  [`server/src/generation.ts`](../../packages/server/src/generation.ts),
  [`server/src/assistant.ts`](../../packages/server/src/assistant.ts),
  [`builder/editor/FillDialog.tsx`](../../packages/app/src/builder/editor/FillDialog.tsx); tests in
  [`mcp.integration.test.ts`](../../packages/server/src/mcp/mcp.integration.test.ts),
  [`assistant.integration.test.ts`](../../packages/server/src/assistant.integration.test.ts) and
  [`tests/e2e/ai.spec.ts`](../../tests/e2e/ai.spec.ts).

## Phase 4: one-click generation

Pick a ship section and get a plausible, on-style screen in one click. The generator works from a content pack
(the starship pack has nine sections) and a seed, so the same choices always give the same screen and a new
seed gives a new one.

**Generate.** The library's Generate dialog shows three takes on a section, each on another layout, previewed in
any show state. Density, aspect and seed are there, with a dice roll for fresh takes. "Also make a screen for each
system" creates a linked suite.

| Three takes | Red alert preview and a suite |
|---|---|
| ![Generate dialog](phase-4/generate-dialog.png) | ![Generate dialog in red alert with a suite](phase-4/generate-dialog-red-alert-suite.png) |

**Generated sections on a display.** Each one is take 1 of its section, published and shown on a 1280 × 720
display. Buttons are at least 60 px in both directions; gauges, readouts and traces move on their own, and readings
that follow a show signal (core output, shields, hull, warp factor) use it.

| Engineering | Tactical |
|---|---|
| ![Generated engineering](phase-4/display-engineering-2.png) | ![Generated tactical](phase-4/display-tactical-2.png) |
| **Science** | **Medical** |
| ![Generated science](phase-4/display-science.png) | ![Generated medical](phase-4/display-medical.png) |
| **Helm** | **Operations** |
| ![Generated helm](phase-4/display-helm.png) | ![Generated operations](phase-4/display-operations.png) |

**Red alert without extra work.** Readings run to their alert ranges, emphasised ones turn danger, status lights
flash, a banner appears and the status line changes.

| Engineering | Medical |
|---|---|
| ![Generated engineering in red alert](phase-4/display-engineering-red-alert.png) | ![Generated medical in red alert](phase-4/display-medical-red-alert.png) |

**Density, shape and theme.** Sparse and dense screens, a portrait display (stacked layout first) and a generated
screen in the base theme.

| Sparse security | Dense communications |
|---|---|
| ![Sparse security](phase-4/display-security-sparse.png) | ![Dense communications](phase-4/display-communications-dense.png) |
| **Environmental, 9:16** | **Communications in the base theme** |
| <img src="phase-4/display-environmental-9x16.png" alt="Environmental on a portrait display" width="300" /> | ![Communications in the base theme](phase-4/display-communications-base-theme.png) |

**Editor.** Regenerate gives everything that is not locked new content in one undoable step (here the title is
locked). Reroll swaps one panel for a fresh one in its place. A placeholder holds a sentence such as "containment
status"; Regenerate fills it with a matching panel.

| Regenerated around a locked title | Reroll one panel |
|---|---|
| ![Editor after Regenerate](phase-4/editor-regenerated.png) | ![Reroll in the inspector](phase-4/editor-reroll.png) |

![Placeholder in the editor](phase-4/editor-placeholder.png)

### Under the hood

- Content packs are data: per section a recipe (systems, readings with resting and alert ranges, buttons, nav
  labels, titles, status lines), plus shared blocks and vocabulary. Blocks are a small language of parts
  (heading, metric, lights, actions, log…) filled from one system.
- The generator is pure and seeded: layout from the recipe's weights, the theme's layouts and the display's shape;
  panels from blocks by fit, size and tags; tones from the theme's palettes; alert reactions from the show's
  states; every screen validated before it is returned.
- Regenerate and Reroll are ordinary ops, so they share undo, locks and revisions with every other edit.
- Code: [`core/src/generator/`](../../packages/core/src/generator/),
  [`core/src/schema/content.ts`](../../packages/core/src/schema/content.ts),
  [`packages/content/`](../../packages/content/src/trek/),
  [`builder/generation.ts`](../../packages/app/src/builder/generation.ts); property tests in
  [`packs.test.ts`](../../packages/content/src/packs.test.ts); e2e in
  [`tests/e2e/generate.spec.ts`](../../tests/e2e/generate.spec.ts).

## Phase 3: living screens

The demo show now moves and answers a touch. Numbers wander, gauges follow the values the story depends on,
buttons on the displays change the whole show, move one display to another screen or play a video, and the
operator steers it all from a phone.

**Live values.** Main engineering is the phase's exit check: the core output gauge and its trace follow a shared
signal the server ticks, the EPS taps wander on their own, numbers scroll in the cascade, plasma bars pulse and relay
lamps blink, each at its own pace. On Tactical, the shield arc and hull gauge follow values the crew sets. The same
widgets in the `base` theme, for comparison.

| Engineering | Tactical |
|---|---|
| ![Main engineering, live](phase-3/engineering-live.png) | ![Tactical with shield and hull gauges](phase-3/tactical-live.png) |
| **Bridge readouts bound to shields, hull and warp factor** | **Engineering in the base theme** |
| ![Bridge with live readouts](phase-3/bridge-live.png) | ![Engineering in the base theme](phase-3/engineering-base-theme.png) |

**Buttons that do something.** Red alert on the bridge puts every display on red alert and raises the shields;
the button gives way to Stand down. Core eject on Main engineering damages the ship: the hull drops, a HULL BREACH
banner flashes and the core output sinks. Diagnostics takes that one display to the ship schematic, whose Back
button returns it.

| Red alert from the bridge | Core eject |
|---|---|
| ![Bridge in red alert after its own button](phase-3/bridge-red-alert-from-button.png) | ![Engineering after core eject](phase-3/engineering-core-eject.png) |

![Ship schematic with a Back button](phase-3/schematic-with-back.png)

**Video.** The Viewscreen plays a sensor sweep; its own Play, Hold and Replay buttons and the operator console
control it.

![Viewscreen with video](phase-3/viewscreen-video.png)

**Operator console.** Live values with big sliders and steps for the values the crew sets, a reading for the ones
that move by themselves, switches for display buttons and sounds, and Play, Pause and Restart for each video on a
display. A card says when a display's own buttons took it elsewhere, with Send back.

| Phone | Tablet |
|---|---|
| <img src="phase-3/operator-phone-live.png" alt="Operator console with live values on a phone" width="300" /> | ![Operator console on a tablet](phase-3/operator-tablet-live.png) |

**Editor.** The inspector binds a prop to a show signal or to a value that wanders by itself, and gives a control
its actions in order. The library edits the show's signals. The preview follows shared values like a display.

| Live value | Actions |
|---|---|
| ![Binding a gauge to a signal](phase-3/editor-live-value.png) | ![A button's actions](phase-3/editor-actions.png) |

![Signals dialog](phase-3/signals-dialog.png)

**Gallery.** All 14 new widgets in every slot, in both themes.

<img src="phase-3/gallery.png" alt="Gallery with the new widgets" width="640" />

### Under the hood

- Signals are `ambient` (each display works the value out from a seed and the clock, no network) or `shared` (the
  server owns it: set by the crew, or ticked every 250 ms and broadcast at most every 100 ms). Widgets follow them
  through `bind`; red alert and damage change their ranges through `byState`.
- Controls send `press { nodeId, value? }`; the server checks the node is a visible control on what that display
  shows and runs navigation, show state and shared values. Show-wide actions can be switched off for a take.
- Theme sounds are synthesised in the browser from the theme manifest; off by default.
- Thumbnails stand still (frozen time, paused animations, no video) so a page of them stays cheap.
- Protocol 4 adds `signals`, `video` and `press`.
- Code: [`core/src/signals/`](../../packages/core/src/signals/),
  [`signals.ts`](../../packages/server/src/signals.ts), [`press.ts`](../../packages/server/src/press.ts),
  [`runtime/live.ts`](../../packages/app/src/runtime/live.ts); e2e flows in
  [`tests/e2e/controls.spec.ts`](../../tests/e2e/controls.spec.ts).

## Phase 2: editor and operator console

The show can now be run and changed without touching a file. `/operator` is a console for a phone or tablet in
a crew member's hand; `/builder` is the screen library and editor for a laptop. Edits are saved as drafts and
reach the displays only when someone presses Publish, unless the show is in live edit mode for rehearsals.

**Operator console (`/operator`).** One big button per show state, read from the show itself, and a separate
blackout panic button that turns into "End blackout". Every display is listed with a live thumbnail of what it
shows in the current state, a screen picker, Identify, Reload, Rename and a QR code with its address. "Add a
display" shows a QR code that opens `/d` on a tablet.

| Phone | Tablet, in red alert |
|---|---|
| <img src="phase-2/operator-phone.png" alt="Operator console on a phone" width="300" /> | ![Operator console on a tablet](phase-2/operator-tablet.png) |

**Screen library (`/builder`).** Thumbnails of every draft, publish status, how many displays show it, search by
name, id, section or tag, and Duplicate. Delete is offered only for screens that no display and no default use.
A new screen starts from one of five layouts, previewed live in the show's theme.

| Library | New screen |
|---|---|
| ![Screen library](phase-2/library.png) | ![New screen dialog](phase-2/new-screen.png) |

**Editor (`/builder/<screen>`).** Add widgets, layouts, decor and uploaded files on the left; the outline shows
the screen as a tree with its slots, and parts are moved by dragging them there. The preview in the middle is the
display runtime itself, so it shows exactly what a display will. The inspector on the right is generated from each
widget's schema: text, tone swatches in the theme's colours, choices, files. Undo and redo cover every change.

![Editor](phase-2/editor.png)

**Per-state changes.** With the preview in Red alert, "Only in Red alert" edits apply to that state alone; the
outline marks nodes with per-state changes (⚡) and the inspector lists them with a Clear button. The same screen in
the `base` theme on a 9:16 display, for comparison.

| Editing Red alert | Portrait, base theme |
|---|---|
| ![Per-state edit](phase-2/editor-per-state.png) | ![Portrait base preview](phase-2/editor-portrait-base.png) |

**Canvas and files.** On a free canvas, parts are dragged and resized in the preview with snapping, nudged with
the arrow keys, or placed with exact percentages. Files are uploaded once per show; the new image widget uses
the images, and videos wait for Phase 3's video widget.

| Canvas | Assets |
|---|---|
| ![Canvas editing](phase-2/editor-canvas.png) | ![Assets and the image widget](phase-2/editor-assets.png) |

**History and send to display.** Every saved change is a revision; any one can be viewed in the preview and
restored, which adds a new revision so nothing is lost. "Send to display" shows the draft on one physical display
with a DRAFT PREVIEW badge, following each edit, without publishing it.

| History | Send to a display |
|---|---|
| ![Revision history](phase-2/editor-history.png) | ![Send to a display](phase-2/send-to-display.png) |

![The draft on the display](phase-2/display-draft-preview.png)

### Under the hood

- Drafts and published copies are stored apart (`screens/` and `published/`); Publish copies a saved revision
  and every display showing it switches at once. The show setting `liveEdit` publishes each edit instead.
- Editor edits are ops sent with `baseRevision`; a stale edit is rebased on the server's copy, and edits made
  elsewhere (another laptop, later the AI) appear in the open editor live. Undo sends the inverse ops.
- Optional `EDITOR_TOKEN` protects `/operator`, `/builder` and every API write; displays never need it. QR codes use
  `PUBLIC_URL` when set.
- Protocol 3 adds the `operator` and `builder` roles, a show `overview` for tools and `watch` for a screen's draft.
- Code: [`operator/`](../../packages/app/src/operator/), [`builder/`](../../packages/app/src/builder/),
  [`showService.ts`](../../packages/server/src/showService.ts); e2e flows in
  [`tests/e2e/`](../../tests/e2e/) (`operator`, `editor`, `auth`).

## Phase 1: core model and LCARS

The demo show is now LCARS. Four hand-written screens cover the three frame archetypes and a free canvas;
nothing in them is LCARS-specific except the decor, so the same documents render in any theme. The show defines
five states, and every display follows a state change at once.

**One screen per archetype.** The theme draws the chrome (elbows, bars, caps) for each archetype; the screen only
says which widgets go in which slot. Buttons are slot-aware: numbered blocks in the sidebar, pills elsewhere.

| Sidebar | Header and main |
|---|---|
| ![Bridge, sidebar](phase-1/bridge-sidebar.png) | ![Engineering, header and main](phase-1/engineering-header-main.png) |
| **Dashboard** | **Canvas with LCARS decor** |
| ![Tactical, dashboard](phase-1/tactical-dashboard.png) | ![Standby, canvas](phase-1/standby-canvas.png) |

**Show states.** The theme recolours each state; screens add their own per-state changes (`when`), such as the
status line, the shield readout or a button that turns into "Stand down". Damaged flickers and jitters on a real
display; blackout hides everything until the next state.

| Yellow alert | Red alert | Damaged |
|---|---|---|
| ![Yellow alert](phase-1/bridge-yellow-alert.png) | ![Red alert](phase-1/bridge-red-alert.png) | ![Damaged](phase-1/bridge-damaged.png) |

![Tactical in red alert](phase-1/tactical-red-alert.png)

**Same document, other looks.** The bridge in the neutral `base` theme, and the LCARS variants Nemesis blue
and Picard grey. Variants are pure data in the theme manifest.

| Base theme | Nemesis variant | Picard variant |
|---|---|---|
| ![Base theme](phase-1/bridge-base-theme.png) | ![Nemesis](phase-1/engineering-nemesis.png) | ![Picard](phase-1/tactical-picard.png) |

**Identify.** The operator asks a display to show its name, so the crew can find it among fifteen screens.

![Identify](phase-1/identify.png)

**Portrait.** The same sidebar screen on a 9:16 display; narrow buttons become rounded blocks.

<img src="phase-1/bridge-9x16.png" alt="Bridge on a portrait display" width="270" />

**Gallery (`/gallery`).** Every frame, every widget in every slot at true scale, and the theme's decor, with
pickers for theme, variant and state effect. The contract tests render the same matrix automatically.

<img src="phase-1/gallery.png" alt="Gallery" width="640" />

### Under the hood

- Screens: [`packages/server/seed/shows/demo/screens/`](../../packages/server/seed/shows/demo/screens/); show,
  states and display assignments: [`show.json`](../../packages/server/seed/shows/demo/show.json)
- Theme pack: [`packages/themes/src/lcars/`](../../packages/themes/src/lcars/) (manifest with variants and
  effects, frames, decor, slot-aware widgets, self-hosted Antonio font)
- Command layer: [`showService.ts`](../../packages/server/src/showService.ts) with a REST adapter in
  [`http/api.ts`](../../packages/server/src/http/api.ts); ops with undo, revision history and lint in `core`
- Measured in e2e: a state change reaches four open displays in under 100 ms

## Phase 0: walking skeleton

A single server process serves the display app. A display opens `/d/<id>`, says hello over Socket.io and renders
the screen it is assigned, here the hand-written demo screen in the neutral `base` theme. Nothing is LCARS yet;
that arrives in Phase 1 as a theme pack, without changing this screen document.

**The same screen document on three display shapes.** Layout is fluid: stacks share space by weight and type
scales with the display, so nothing is positioned in pixels.

| 16:9 TV | 4:3 tablet | 9:16 portrait |
|---|---|---|
| ![16:9](phase-0/welcome-16x9.png) | ![4:3](phase-0/welcome-4x3.png) | ![9:16](phase-0/welcome-9x16.png) |

**Server restart during a take.** The display keeps its last screen and shows a small badge in the corner
until the server is back, then reconnects on its own.

![Reconnecting](phase-0/reconnecting.png)

**Mistyped display address.** Ids are short, lowercase and path-safe; anything else gets a clear message.

![Invalid id](phase-0/invalid-id.png)

### Under the hood

- Screen document: `packages/server/seed/shows/demo/screens/welcome.json` (replaced by the LCARS screens in Phase 1)
- Widget catalog: `title`, `text`, `button`, each one `defineWidget()` file in `packages/core/src/catalog/`
- Theme: `base` (`packages/themes/src/base/`), the fallback every future theme builds on
- Docker image with a persistent `/data` volume; CI builds it and checks that data survives a restart
