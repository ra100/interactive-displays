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
            schema/   Zod schemas: ids, tones, node tree, Screen, Show, theme manifest
            catalog/  defineWidget() registry; one file per widget
            validate/ validateScreen: schema + unique ids + known kinds + props
            protocol/ typed Socket.io events (hello → snapshot)
  themes/   @interactive-displays/themes
            ./manifest  pure data (server-safe): theme tokens
            ./react     browser only: widget renderers, CSS
            base/       neutral theme that renders every widget; the fallback for all other themes
  server/   Fastify + Socket.io + static app, one process, one port; runs TS directly (no build)
            seed/     demo show copied into an empty data directory on first start
  app/      React 19 + Vite SPA: /d/:displayId display route and runtime (ScreenView, NodeView)
tests/e2e/  Playwright, against the built app served by the real server
data/       runtime data (gitignored): settings.json, shows/<id>/show.json, shows/<id>/screens/*.json
```

**Import boundaries:** `core` imports only `zod`. Theme manifests import only `core`. The server imports `core`
(and later theme manifests). Only `app` imports `@interactive-displays/themes/react`.

**Key ideas** (details in the plan):

- Documents store *meaning*, themes decide *look*. Screens are a tree of containers and widgets; colours are
  tone roles (`primary`, `accent`, `danger`, …), never hex values.
- Every widget is one `defineWidget()` definition: Zod props schema, defaults, an example, a description for AI.
  Types, validation, JSON Schema, contract tests and (later) the editor inspector all come from it.
- Themes are packs: a pure-data manifest plus React renderers. Missing renderers fall back to `base`.
- Layout is fluid: stacks with weights, `--u` (1% of the display's shorter side) and container query units.
- A display says `hello` and gets a full `snapshot`; reconnecting is just another hello.

## Commands

```bash
pnpm install          # Node >= 22.18 (Node 24 in Docker/CI), pnpm 9
pnpm dev              # server on :3010 (node --watch) + Vite on :5176 (proxies /socket.io)
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
- **Touch targets ≥ 60 px.** Buttons give immediate `:active` feedback.
- **A broken widget never breaks a display**: props are re-validated in the runtime and each widget has an
  error boundary.

### Adding a widget

1. `packages/core/src/catalog/<kind>.ts` with `defineWidget({ kind, label, category, description, props, example })`.
2. Add it to the `widgets` object in `packages/core/src/catalog/index.ts` and extend `catalog.test.ts`.
3. Add a base renderer in `packages/themes/src/base/` and register it in `base/renderers.ts`
   (the compiler requires it; the contract test renders the example in every theme).

### Adding a theme

1. `packages/themes/src/<id>/manifest.ts` with `defineTheme({ id, name, tokens })`; register it in `src/manifest.ts`.
2. Optional renderers in `packages/themes/src/<id>/renderers.ts`; register them in `src/react.ts`.
3. The contract test covers the new theme automatically.

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

Task-specific guidance lives in `.claude/skills/`: `widgets` (catalog and renderers), `themes` (theme packs),
`server` (data, protocol, deployment).
