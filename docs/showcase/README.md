# Showcase

What each phase of the v2 rebuild looks like. Screenshots are captured by `tests/e2e/showcase.spec.ts`
against the real server and built app (`pnpm build && SHOWCASE=phase-N pnpm test:e2e showcase`).

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
