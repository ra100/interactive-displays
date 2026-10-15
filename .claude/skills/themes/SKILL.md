---
name: themes
description: Create or change theme packs in packages/themes (manifest tokens, variants, state effects, frames, decor, renderers, CSS). Use when styling displays, adding a new look such as LCARS or a CRT terminal, or changing how tones, frames or states look.
---

# Themes

A theme pack has two halves:

- `src/<id>/manifest.ts`: pure data via `defineTheme({ id, name, description, tokens, variants, effects,
  archetypes, decor, sounds })`. Imported by the server, generator and MCP, so it may import only `core` and `zod`.
- `src/<id>/renderers.ts` + components + CSS: browser only, registered in `src/react.ts`.

Register the manifest in `src/manifest.ts`. Anything a theme does not render falls back to `base`, except decor.

## What a theme provides

| Part | Where | Notes |
|---|---|---|
| Tokens | manifest `tokens` | 8 tone colours, background, foreground, fonts, radius |
| Variants | manifest `variants` | named token overlays (`nemesis`, `picard`); a show picks one in `theme.variant` |
| State effects | manifest `effects` + CSS | token overlays per effect (`warning`, `alert`, `damaged`); CSS keyed on `.screen[data-effect=…]` for motion |
| Frames | `renderers.frames` | one component per archetype; receives `slots` (already rendered) and places them |
| Widgets | `renderers.widgets` | receive validated `props`, `nodeId` and `slot` (draw a nav button differently from a toolbar one) |
| Decor | manifest `decor` + `renderers.decor` | `defineDecor({ kind: "<id>.<name>", props, example })`, rendered only in this theme |
| Sounds | manifest `sounds` | synthesised with Web Audio: steps of `{ freq, to?, ms, wave, gain }`, `repeat`; base has `press`, `confirm`, `warning`, `alert`, and a theme overrides or adds (`lcars` adds `hail`). Keep the shared names so a show sounds right in every theme |

Tokens are resolved in order: base tokens, then the show's variant, then the current state's effect
(`resolveTokens`). The runtime handles `blackout` (hides everything) and a generic `damaged` flicker for every
theme; add your own looks on top.

## CSS variables

| Variable | Meaning |
|---|---|
| `--tone-<role>` | palette colour per tone role (all 8 roles required) |
| `--tone` | the current element's tone, set by `[data-tone=…]` (see `src/tones.css`) |
| `--theme-bg`, `--theme-fg` | background and default text colour |
| `--font-display`, `--font-body` | font stacks (self-host fonts with `@fontsource/*`; displays may be offline) |
| `--radius` | corner radius (`none`, `small`, `pill`) |
| `--u` | 1% of the display's shorter side, set by the runtime |
| `--touch` | minimum touch target: 60 px on a display, scaled in previews; use it for anything pressable |

The screen root also carries `data-theme`, `data-variant`, `data-state`, `data-effect` and, in thumbnails,
`data-still` (animations paused).

Runtime helpers for renderers (`src/runtime.ts`): `useShowStateInfo()` (current state's label and banner, for
the alert banner), `useNow(ms)` (a shared ticker), `useStill()`, `usePressFlash()` (a camera-visible flash on
press) and `useMediaCommands(nodeId, listener)` (video commands from buttons and the operator).

## Rules

- Never hard-code a palette colour in a renderer or CSS; use `var(--tone)` or `var(--tone-<role>)`.
- Class names are prefixed with the theme id (`base-button`, `lcars-button`) so themes never collide.
- Size everything in `--u` or container units of the widget box (`cqh`, `cqw`); frames give fixed-height slot
  rows (title, toolbar, status) a definite size because widget slots are size containers.
- A screen must render in every theme. If something only works in one theme, that is a bug; theme-specific
  shapes are decor, not widgets.
- `contract.test.tsx` renders every widget in every slot, every frame and every decor piece in every theme;
  keep it green, then check the result by eye at `/gallery?theme=<id>&variant=…&effect=…`.
