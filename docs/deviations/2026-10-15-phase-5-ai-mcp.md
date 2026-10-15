# Deviation: Phase 5 ships MCP and Fill with AI without previews, shapes, theme variants or an audit log

## Date
2026-10-15

## Original Plan
Section 11 and the Phase 5 row of section 17:

- `/mcp` with discover, generate, edit, check, library and gated live tools, including `get_catalog(theme?)`,
  `render_preview` (a PNG from headless Chromium in a `-full` image), `save_shape` (sanitised SVG) and
  `save_theme_variant`.
- Resources `catalog`, `themes/{id}`, `screens/{id}`, `recipes/{id}` and `guides/design-rules`, and three prompts.
- Gating through `settings.ai.allowPublish` and `settings.ai.allowLiveControl`; an `MCP_ENABLED` variable.
- Fill with AI through the Anthropic tool runner on a scratch copy with `get_catalog`, `get_screen`, `apply_ops` and
  `lint_screen`, using `output_config: { effort: 'medium' }` and server-side fallbacks.
- An audit log of who changed what, and command-layer parity tests across REST, Socket.io and an in-process MCP
  client.

## What Changed
1. **No `render_preview`, `save_shape`, `save_theme_variant` or audit log yet.** The MCP client reads screens as a
   text outline (`get_screen` with `format: "outline"`) or as JSON, and checks them with `lint_screen`. Blocks and
   recipes are the only new elements AI can save.
2. **Tool names and shapes:**
   - `get_catalog(kind?)` lists widgets, or gives one widget's JSON Schema; the theme comes from `get_theme`.
   - `list_recipes(section?)` gives a list, or one recipe in full.
   - `regenerate` takes `nodes` for the panels to reroll, rather than a `scope` argument.
   - `create_screen` was added for documents written from scratch.
3. **Resources:** `interactive-displays://guide`, `://catalog`, `://recipes` and `://screens/{id}`. Recipes are one
   resource, not one per recipe, and there is no `themes/{id}` resource (`get_theme` covers it).
4. **Settings are flat:** `aiPublish` and `aiLiveControl` on the show's settings, switched in the operator console.
   There is no `MCP_ENABLED`: `/mcp` is always mounted and sits behind `EDITOR_TOKEN` like every write.
5. **Fill with AI's tools are `look`, `get_node`, `get_widget` and `apply_ops`.** `look` returns the outline with
   lint warnings, so it replaces both `get_screen` and `lint_screen`. The run uses adaptive thinking and the SDK
   defaults, with no effort setting or fallbacks, and is capped at 16 model turns. `AI_MODEL` overrides the
   default `claude-opus-5-5`.
6. **Parity tests compare MCP with REST** (the same seed generates the same screen; reads match). Socket.io is
   left out because it only carries reads and presses, and those are already tested.
7. **Generation moved onto the server as well.** MCP generates through `server/src/generation.ts`, which merges
   the show's own recipes and blocks (`shows/<id>/content/<pack>.json`) into the built-in packs. The builder still
   generates in the browser, and now loads the packs from `GET /api/content` so it sees the saved recipes too.

## Justification
- The image preview needs Chromium in the server image. That would roughly triple the image size and add a moving
  part, and an outline plus lint already let a model check its own work. People see AI edits live in the editor
  anyway.
- Shapes and theme variants need a sanitiser and new renderer paths. They fit better with Phase 6's work on themes
  and the second UI family.
- Flat settings match the other show switches and the operator console's switch list.
- One `look` tool keeps the built-in loop short and cheap. Adaptive thinking is the recommended default for
  multi-step tool use on this model.

## Impact
- MCP clients cannot see pixels. Descriptions and the design guide carry the visual rules, and the operator and
  editor remain the visual check.
- Adding `render_preview` later is additive: one more tool, plus an optional `-full` image.
- Without an audit log, who changed what has to be traced from revision history and the server log. Every MCP tool call and every Fill with
  AI run is logged.
- Deployments that set no `ANTHROPIC_API_KEY` lose nothing: the button is hidden and `/mcp` works without a key.
