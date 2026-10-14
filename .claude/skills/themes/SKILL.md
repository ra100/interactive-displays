---
name: themes
description: Create or change theme packs in packages/themes (manifest tokens, renderers, CSS). Use when styling displays, adding a new look such as LCARS or a CRT terminal, or changing how tones map to colours.
---

# Themes

A theme pack has two halves:

- `src/<id>/manifest.ts`: pure data via `defineTheme({ id, name, tokens })`. Imported by the server, generator
  and MCP, so it may import only `@interactive-displays/core`.
- `src/<id>/renderers.ts` + components + CSS: browser only, registered in `src/react.ts`.

Register the manifest in `src/manifest.ts`. Any widget a theme does not render falls back to `base`.

## Tokens → CSS

`themeCssVariables(tokens)` puts these on the screen root; renderers only read variables:

| Variable | Meaning |
|---|---|
| `--tone-<role>` | palette colour per tone role (all 8 roles required) |
| `--tone` | the current element's tone, set by `[data-tone=…]` (see `src/tones.css`) |
| `--theme-bg`, `--theme-fg` | background and default text colour |
| `--font-display`, `--font-body` | font stacks |
| `--radius` | corner radius (`none`, `small`, `pill`) |
| `--u` | 1% of the display's shorter side, set by the runtime |

## Rules

- Never hard-code a palette colour in a renderer; use `var(--tone)` or `var(--tone-<role>)`.
- Class names are prefixed with the theme id (`base-button`, `lcars-button`) so themes never collide.
- A screen must render in every theme. If something only works in one theme, that is a bug.
- `contract.test.tsx` renders every widget's example in every registered theme; keep it green.
- Theme-specific shapes (LCARS elbows, bars, caps) are decor, not widgets (see the plan, section 8).
