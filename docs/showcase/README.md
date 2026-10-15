# Showcase

What each phase of the v2 rebuild looks like. Screenshots are captured by `tests/e2e/showcase.spec.ts`
against the real server and built app (`pnpm build && SHOWCASE=phase-N pnpm test:e2e showcase`).

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
