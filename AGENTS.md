# AGENTS.md

Guidance for AI agents and humans working in this repository.

## Project

Interactive Displays: a self-hosted system that drives 6–15 browser displays on a film set with sci-fi interfaces
(Star Trek LCARS first, other looks later), coordinated in real time from one server.

**Source of truth:** `docs/plans/2026-10-14-feat-interactive-displays-v2-plan.md` (the v2 design and roadmap).
The v1 code is kept read-only under `legacy/` for reference; never import from it.

## Architecture

```
packages/
  core/     @interactive-displays/core    pure TS, no React, no Node APIs; runs in browser and server
            schema/   Zod schemas: ids, tones, archetypes and slots, node tree, Screen (draft revision and
                      published revision, generator provenance), Show (states, signals, displays, settings),
                      signals and bindings, actions, assets, theme manifest (with sounds and tone palettes),
                      content packs (recipes, blocks, vocabulary)
            catalog/  defineWidget() registry (one file per widget) and defineDecor()
            tree/     walk/find nodes; nodeInState applies `when` overrides for a show state; turnTree rearranges
                      a screen for a display turned the other way (rows to columns, grids on their side)
            signals/  sample a signal at a moment (seeded walk, wave, clock), per-state sources, bindProps
            validate/ validateScreen: schema, unique ids, known kinds, props, slots, grid areas, decor
            ops/      the operation language (insert, remove, move, update, set, place, layout, replace,
                      meta): all-or-nothing, returns inverse ops for undo, can respect locks
            generator/ seeded generator: generateScreen, generateVariants, generateSuite, regenerateOps (around
                      locked parts and placeholders), rerollOps (one panel); blocks.ts fills a block from a system
            lint/     lintScreen: structural warnings (empty containers, missing main slot, long labels…)
            fields/   describeFields: inspector form fields from a props schema
            migrate/  migrateScreen: upgrades older screen documents on read
            protocol/ typed Socket.io events: hello (display, operator, builder) → snapshot or overview,
                      state, signals, video, identify, reload, watch → screen, press, error
  content/  @interactive-displays/content
            trek/     the Starship pack for LCARS: recipes/<section>.json (9 sections), blocks.json, vocab.json
            corvette/ the Patrol corvette pack written for the HUD (6 sections); freighter/ the Deep-space
                      freighter pack for the CRT terminal (7 sections); a pack names its `theme`
                      index.ts exports `packs` (schema-checked on load) and `findRecipe("trek/engineering")`
  themes/   @interactive-displays/themes
            ./manifest  pure data (server-safe): theme manifests, decor catalog
            ./react     browser only: widget, frame and decor renderers, CSS
            base/       neutral theme that renders every widget and frame; the fallback for all others
            lcars/      LCARS: TNG palette + variants, effects, sounds, three frames, four decor pieces, Antonio font
            hud/        Holo HUD: translucent panels, Rajdhani + Share Tech Mono, reticle/corners/scale/arcs decor
            crt/        Terminal: green phosphor CRT (amber and ice variants), VT323, rules/brackets/radar decor
  server/   Fastify + Socket.io + static app, one process, one port; runs TS directly (no build)
            showService.ts  the command layer: every change is validated, persisted and broadcast here;
                            drafts, publish, revisions, previews, assets, signals, display presses
            signals.ts      shared signal values: manual ones set by people, walking ones ticked every 250 ms
            press.ts        which node a display press may run (visible, interactive, with actions)
            http/api.ts     REST adapter over the command layer; EDITOR_TOKEN guards every write
            generation.ts   content packs (built in plus the show's saved recipes and blocks), generate, regenerate
            mcp/            MCP at /mcp (Streamable HTTP, stateless): tools, resources and prompts over the same
                            command layer; publishing and live control only when the operator allows them
            realtime.ts     Socket.io adapter: display snapshots, tool overviews, watched drafts
            storage/        data directory: atomic JSON writes, revision history, published copies, assets
            seed/           LCARS demo show copied into an empty data directory on first start
  app/      React 19 + Vite SPA
            runtime/  ScreenView, NodeView (stack, grid, canvas, frame), WidgetView, DecorView; live.ts
                      (shared values store, controls), sound.ts (Web Audio player for theme sounds)
            display/  /d/:displayId: connection, state changes, signals, presses, video commands, state
                      sounds, identify overlay, draft preview badge
            gallery/  /gallery (lazy): every frame, widget-by-slot and decor per theme, variant and effect
            operator/ /operator (lazy): cues (GO, space bar, record what is on air), state buttons, blackout,
                      live value sliders, Look (theme, variant, size, sound pack), display switches, display cards
                      (assign, size, identify, QR, video transport, send back)
            builder/  /builder (lazy): library/ (screens, templates, Generate dialog, signals), generation.ts
                      (generator inputs from the show and theme, regenerate and reroll) and editor/ (session with undo
                      and rebase, outline, preview with drag-and-drop, edge and grid resizing and quick layout
                      buttons, inspector with live values and actions, history, assets, send to display)
            tools/    shared by operator and builder: connection, token gate, API client, dialogs
tests/e2e/  Playwright, against the built app served by the real server
data/       runtime data (gitignored): settings.json, shows/<id>/{show,runtime}.json, shows/<id>/screens/
            (drafts and .history/), shows/<id>/published/, shows/<id>/assets/
```

**Import boundaries:** `core` imports only `zod`. `content` imports only `core`. Theme manifests import only `core`
and `zod`. The server imports `core`, `content`, `@interactive-displays/themes/manifest` and the MCP SDK. Only `app` imports `@interactive-displays/themes/react`.

**Key ideas** (details in the plan):

- Documents store *meaning*, themes decide *look*. Screens are a tree of containers, widgets and decor;
  colours are tone roles (`primary`, `accent`, `danger`, …), never hex values.
- Containers lay out as a `frame` (an archetype with named slots whose chrome the theme draws), `stack`,
  `grid` or `canvas`. Widgets learn their slot, so a theme can draw a nav button differently from a toolbar one.
- Decor (`lcars.elbow`) is ornament that belongs to one theme. Another theme draws it with the stand-in its
  manifest names in `decorStandIns` (`lcars.bar` → `hud.scale`), or hides it.
- A show defines its states (`normal`, `red-alert`, …), each naming an effect (`none`, `warning`, `alert`,
  `damaged`, `blackout`) and optionally a theme sound. The theme restyles each effect; nodes can override props
  or visibility per state with `when`.
- Live values are signals: `ambient` ones (walk, wave, clock) are worked out on every display from a seed and cost
  no network; `shared` ones are owned by the server (set by the operator or display buttons, or ticked) and
  broadcast at most every 100 ms. Widgets follow them through `bind`; per-state ranges go in `byState`.
- Controls (button, button group, toggle, slider) carry `actions`: navigate and back (that display only),
  setState, setSignal and cue (show-wide, behind the `displayGlobalActions` setting), video and sound (run on
  the display).
- A show has a running order of `cues`; each sets the state, shared values, display screens and videos at once.
  The operator's GO runs the next one; the last cue run survives a restart. A press goes to the server as `press { nodeId, value? }`; the server decides what it may do.
- One-click generation: a content pack recipe (systems, readings with alert ranges, buttons, nav labels) plus a
  seed, density and display shape gives a screen. The same inputs always give the same screen; locked nodes keep
  their place, `placeholder` widgets are filled by matching their intent, and alert ranges become `byState` for the
  show's alert and damaged states. Regenerate and Reroll are ordinary ops (one Undo).
- Every change goes through the command layer (`showService.ts`) as validated ops with revision checks.
  Ops change a screen's draft; displays show its published copy until someone publishes (or the show is in
  live edit mode). The editor, the operator console and MCP clients all go through the same command layer.
- AI works through MCP at `/mcp`: discover (catalog, theme, screens, recipes), generate, edit with ops (locks always
  respected), lint, save recipes and blocks. Publishing needs the show's `aiPublish` setting and assigning screens,
  changing state or signals needs `aiLiveControl`; both are off until the operator turns them on.
- Every widget is one `defineWidget()` definition: Zod props schema, defaults, an example, a description for AI.
  Types, validation, JSON Schema, contract tests and the editor's inspector all come from it.
- Themes are packs: a pure-data manifest (tokens, variants, effects, decor) plus React renderers for widgets,
  frames and decor. Missing renderers fall back to `base`.
- Archetypes: `sidebar`, `header-main`, `dashboard`, `split` (the LCARS double frame) and `console` (all six
  slots). LCARS sources and the element inventory are in `docs/reference/lcars.md`.
- Layout is fluid: stacks with weights, `--u` and container query units. `--u` is 1% of the display's shorter side
  times the scale: the show's (0.7 by default, for 4K panels of 80–100"), a display's own, and any node's `scale`.
- A screen on a display turned the other way from its `profile.aspect` is rearranged, not stretched: frames draw
  portrait chrome (nav as a band, aside below main), rows of panels become columns, grids turn. A node's
  `turned: { arrange, hidden }` and the screen's `profile.rearrange` override it.
- A display says `hello` and gets a full `snapshot`; reconnecting is just another hello. Show state changes
  arrive as a small `state` event so they reach every display within 100 ms.

## Commands

```bash
pnpm install          # Node >= 22.18 (Node 24 in Docker/CI), pnpm 9
pnpm dev              # server on :3010 (node --watch) + Vite on :5176 (proxies /api, /socket.io, /media)
pnpm test             # unit + integration tests in every package (Vitest)
pnpm build            # builds the app into packages/app/dist
pnpm test:e2e         # Playwright; run `pnpm build` first
pnpm lint             # oxlint (.oxlintrc.json)
pnpm typecheck        # tsc --noEmit in every package
pnpm knip             # unused files, exports and dependencies
pnpm start            # production server serving the built app
docker compose up -d  # production image with a persistent volume
```

Showcase screenshots: `pnpm build && SHOWCASE=phase-N pnpm test:e2e showcase` writes `docs/showcase/phase-N/*.png`.
In a container without a matching Playwright browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

## Conventions

- **TypeScript strict**, no `any`, no non-null assertions; `exactOptionalPropertyTypes` is on.
- **Fat arrow functions** (`const fn = () => {}`); error boundaries are the only classes.
- **Relative imports use the `.ts`/`.tsx` extension** (Node runs the server's TypeScript directly with type
  stripping), and only erasable syntax is allowed (no enums, namespaces or parameter properties).
- **Zod 4 is the single schema source.** Derive types with `z.infer`; never hand-write a type that mirrors a schema.
- **No hex colours in documents or renderers**; renderers read CSS variables (`var(--tone)`, `var(--theme-bg)`).
- **Buttons are 1–2 cm tall on the real panel.** Theme CSS uses `var(--touch)` for anything pressable: the show's
  `panel.buttonCm` (1.5 cm) worked out from the panel's diagonal (`panel.inches`, 90" by default, or the display's
  own) through `--cm`. Never size a button with `--u`; buttons give immediate `:active` feedback.
- **A broken widget never breaks a display**: props are re-validated in the runtime and each widget has an
  error boundary.

### Adding a widget

1. `packages/core/src/catalog/<kind>.ts` with `defineWidget({ kind, label, category, description, props, example })`.
2. Add it to the `widgets` object in `packages/core/src/catalog/index.ts` and extend `catalog.test.ts`.
3. Add a base renderer in `packages/themes/src/base/` and register it in `base/renderers.ts`
   (the compiler requires it; the contract test renders the example in every theme).

### Adding a theme

1. `packages/themes/src/<id>/manifest.ts` with `defineTheme({ id, name, tokens, variants, effects, archetypes,
   decor })`; register it in `src/manifest.ts`. Decor kinds must be named `<id>.<name>`.
2. Renderers for widgets, frames and decor in `packages/themes/src/<id>/renderers.ts` (all optional except
   decor); register them in `src/react.ts`.
3. Map other themes' decor to your pieces in the manifest's `decorStandIns`, so re-skinned screens keep their
   ornament.
4. The contract tests render every widget in every slot, every frame and every decor piece in the new theme
   automatically; check it by eye at `/gallery?theme=<id>`, and on a 4K viewport at 70%.
5. Give it a content pack (`packages/content/src/<pack>/`, `theme: "<id>"`) so generated screens look native.

### Adding a ship section

1. `packages/content/src/trek/recipes/<section>.json` (see `ContentPackSchema` in `core/src/schema/content.ts`) and
   add it to `trek/pack.ts`. Name show signals in `signal` only if the demo show has them.
2. `pnpm --filter @interactive-displays/content test`: the property tests generate it for every seed, density and
   shape and must stay valid and lint-clean. Look at it in the Generate dialog.

## Workflow

### TDD (mandatory)

Write the test first or alongside the code; every change ships with tests.

| Type | Pattern | Where |
|---|---|---|
| Unit | `*.test.ts(x)` | next to the source |
| Integration | `*.integration.test.ts(x)` | next to the source |
| E2E | `*.spec.ts` | `tests/e2e/` |

### Commits

Conventional Commits with gitmoji, small and always green:

```
🎉 feat(core): add readout widget
🐛 fix(server): keep displays connected across restart
♻️ refactor(app): simplify node rendering
✅ test: add e2e restart flow
📝 docs: update testing guide
🔧 chore: bump dependencies
🐳 chore: adjust Docker image
```

### Phases and pull requests

Each roadmap phase from the plan ships as its own pull request, stacked on the previous phase's branch.
Every phase PR includes screenshots (`docs/showcase/phase-N/`), an updated showcase page
(`docs/showcase/README.md`) and a manual testing guide (`docs/ACCEPTANCE-TESTING.md`).

### Plan deviations

When the implementation departs from the plan, add `docs/deviations/YYYY-MM-DD-<topic>.md` with the sections
Date, Original Plan, What Changed, Justification and Impact.

## Skills

Task-specific guidance lives in `.claude/skills/`: `widgets` (catalog and renderers), `themes` (theme packs,
frames, decor, effects), `server` (command layer, REST API, data, protocol, deployment), `content` (content packs,
recipes, blocks and the generator).
