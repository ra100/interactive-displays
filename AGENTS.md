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
                      published revision), Show (states, displays, settings), assets, theme manifest
            catalog/  defineWidget() registry (one file per widget) and defineDecor()
            tree/     walk/find nodes; nodeInState applies `when` overrides for a show state
            validate/ validateScreen: schema, unique ids, known kinds, props, slots, grid areas, decor
            ops/      the operation language (insert, remove, move, update, set, place, layout, replace,
                      meta): all-or-nothing, returns inverse ops for undo, can respect locks
            lint/     lintScreen: structural warnings (empty containers, missing main slot, long labels…)
            fields/   describeFields: inspector form fields from a props schema
            migrate/  migrateScreen: upgrades older screen documents on read
            protocol/ typed Socket.io events: hello (display, operator, builder) → snapshot or overview,
                      state, identify, reload, watch → screen, error
  themes/   @interactive-displays/themes
            ./manifest  pure data (server-safe): theme manifests, decor catalog
            ./react     browser only: widget, frame and decor renderers, CSS
            base/       neutral theme that renders every widget and frame; the fallback for all others
            lcars/      LCARS: TNG palette + variants, effects, three frames, four decor pieces, Antonio font
  server/   Fastify + Socket.io + static app, one process, one port; runs TS directly (no build)
            showService.ts  the command layer: every change is validated, persisted and broadcast here;
                            drafts, publish, revisions, previews, assets
            http/api.ts     REST adapter over the command layer; EDITOR_TOKEN guards every write
            realtime.ts     Socket.io adapter: display snapshots, tool overviews, watched drafts
            storage/        data directory: atomic JSON writes, revision history, published copies, assets
            seed/           LCARS demo show copied into an empty data directory on first start
  app/      React 19 + Vite SPA
            runtime/  ScreenView, NodeView (stack, grid, canvas, frame), WidgetView, DecorView
            display/  /d/:displayId: connection, state changes, identify overlay, draft preview badge
            gallery/  /gallery (lazy): every frame, widget-by-slot and decor per theme, variant and effect
            operator/ /operator (lazy): state buttons, blackout, display cards (assign, identify, QR)
            builder/  /builder (lazy): library/ (screens, templates) and editor/ (session with undo and
                      rebase, outline, preview, inspector, history, assets, send to display)
            tools/    shared by operator and builder: connection, token gate, API client, dialogs
tests/e2e/  Playwright, against the built app served by the real server
data/       runtime data (gitignored): settings.json, shows/<id>/{show,runtime}.json, shows/<id>/screens/
            (drafts and .history/), shows/<id>/published/, shows/<id>/assets/
```

**Import boundaries:** `core` imports only `zod`. Theme manifests import only `core` and `zod`. The server
imports `core` and `@interactive-displays/themes/manifest`. Only `app` imports `@interactive-displays/themes/react`.

**Key ideas** (details in the plan):

- Documents store *meaning*, themes decide *look*. Screens are a tree of containers, widgets and decor;
  colours are tone roles (`primary`, `accent`, `danger`, …), never hex values.
- Containers lay out as a `frame` (an archetype with named slots whose chrome the theme draws), `stack`,
  `grid` or `canvas`. Widgets learn their slot, so a theme can draw a nav button differently from a toolbar one.
- Decor (`lcars.elbow`) is ornament that belongs to one theme and is hidden in every other theme.
- A show defines its states (`normal`, `red-alert`, …), each naming an effect (`none`, `warning`, `alert`,
  `damaged`, `blackout`). The theme restyles each effect; nodes can override props or visibility per state
  with `when`.
- Every change goes through the command layer (`showService.ts`) as validated ops with revision checks.
  Ops change a screen's draft; displays show its published copy until someone publishes (or the show is in
  live edit mode). The editor and operator console are clients of the same REST API and socket.
- Every widget is one `defineWidget()` definition: Zod props schema, defaults, an example, a description for AI.
  Types, validation, JSON Schema, contract tests and the editor's inspector all come from it.
- Themes are packs: a pure-data manifest (tokens, variants, effects, decor) plus React renderers for widgets,
  frames and decor. Missing renderers fall back to `base`.
- Layout is fluid: stacks with weights, `--u` (1% of the display's shorter side) and container query units.
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
- **Touch targets ≥ 60 px.** Theme CSS uses `var(--touch)` (60 px on a display, scaled down in previews) for
  anything pressable; buttons give immediate `:active` feedback.
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
3. The contract tests render every widget in every slot, every frame and every decor piece in the new theme
   automatically; check it by eye at `/gallery?theme=<id>`.

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
frames, decor, effects), `server` (command layer, REST API, data, protocol, deployment).
