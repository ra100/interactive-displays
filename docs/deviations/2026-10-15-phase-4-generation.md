# Deviation: Phase 4 generates in the browser from a content package with a small block language

## Date
2026-10-15

## Original Plan
Section 10 and the Phase 4 row of section 17: a content pack format and a default `trek` pack with at least eight
section recipes and a block library; a seeded generator that picks an archetype (recipe ∩ theme ∩ profile), keeps
locked nodes, fills slots from blocks by role, size and tags, labels from the recipe and vocabulary in the theme's
number format, binds metrics to ambient signals with `alertRange` as a `byState` override, assigns tones by theme
rules, and regenerates a failing subtree with a sub-seed; reroll of the screen or one panel (undo as a revision
revert), lock, regenerate unlocked, placeholders, a generated suite with wired nav, a Generate dialog with three
variants, and property and snapshot tests. Section 6 sketches `generator: { recipe, archetype, seed, density }` on
a screen; section 10.2 sketches the recipe JSON (with `widgets` per metric and an `action-panel` block of danger
buttons with confirm) and section 8 a theme `generator` entry with `numberFormat` and `maxLabelChars`.

## What Changed
1. **Content lives in a workspace package**, `@interactive-displays/content` (`packages/content/src/trek/`): one
   JSON file per section, `blocks.json` and `vocab.json`, checked against `ContentPackSchema` (in `core`) when the
   module loads. It imports only `core`. Nine sections ship: engineering, environmental, tactical, helm, science,
   medical, communications, security and operations.
2. **The builder generates in the browser.** The Generate dialog runs the generator locally (instant, offline) and
   creates the chosen screens through the normal `POST /api/screens`. Regenerate and Reroll in the editor produce
   ops that go through the editor's normal op path, so one Undo brings the previous screen back (no revision revert
   needed). The server does not generate yet; Phase 5's MCP tools will import the same package.
3. **Blocks are a small parts language, not widget trees.** A block's `layout` is a tree of parts (`heading`,
   `metric`, `metrics`, `lights`, `actions`, `ambient`, `notes`, `log`, `clock`, `stack`) that the generator fills
   from one system of the recipe, with `fits` (main or aside), `size`, `needs` (readings and buttons the system must
   have) and `tags`. Twelve blocks ship. This keeps blocks theme-neutral and makes them easy for AI to write.
4. **Recipe format.** Metrics say `prefer` (gauge, readout, sparkline) instead of `widgets`, and may name a show
   `signal` to follow when the show has it. Recipes add a `code` (ENG), `status` lines, `tags`, `alert.status` lines,
   and systems add `short` nav labels and `notes`. Codes and technobabble come from the pack's `vocab`
   (`codeFormats` such as `##-####`), not from a theme `numberFormat`; label lengths are enforced by the schemas and
   lint.
5. **Theme tone rules are two palettes**: `tones.nav` and `tones.panels` in the theme manifest. Nav buttons cycle
   through the first, panels and their readings through the second, from a seeded offset.
6. **Provenance** is `generator: { recipe, seed, density, suite?, system? }`. The archetype is not stored: it is
   the root frame's layout, and Regenerate keeps it.
7. **Alert behaviour.** Ambient bindings take `byState` inline (the `alertRange` for every show state whose effect
   is `alert` or `damaged`, moving faster). Emphasised readings turn `danger` in those states; status lights warn,
   and emphasised ones flash danger. A hidden `alert-banner` shows in `warning`, `alert` and `damaged` states, and
   the status line swaps to an alert line. A show without such states gets none of this.
8. **No confirm on danger buttons.** Danger actions get the `danger` tone only; there is no confirm step on
   displays (an actor's tap must act at once on camera). Buttons keep only actions the show can run (known states,
   settable signals); video actions are dropped.
9. **Validation retries the whole screen.** A screen that fails `validateScreen` is generated again with a
   sub-seed (up to four attempts) instead of regenerating a subtree; in the property tests no screen has needed it.
10. **Suites** use only layouts with a nav or toolbar slot, and every screen of a suite shares the overview's
    layout. The overview's nav lists the systems; each system screen's nav has Overview and the other systems.
11. **Placeholders are filled by words.** The generator matches a placeholder's intent against the systems' labels,
    readings and buttons and the blocks' tags, and puts the panel where the placeholder was. Locked parts keep their
    slot and place; a locked part in a slot the layout lacks moves to main rather than being dropped.
12. **Property tests instead of snapshot tests.** `packages/content/src/packs.test.ts` uses fast-check over every
    section, seed, density, aspect and layout: valid, lint-clean against the demo show, deterministic, at most eight
    buttons per stack, and locked parts survive any regeneration. The e2e suite checks every button on a generated
    display is at least 60 px both ways.

## Justification
Generating in the browser gives instant thumbnails with no server round trip and keeps the server's command layer
unchanged; the package boundary lets the server import the same code when MCP needs it. The parts language is far
smaller than widget trees, cannot produce invalid nodes, and adapts one block to any system. Storing the archetype
twice would let the two disagree. Confirm dialogs on displays would get in the way of a scene.

## Impact
- New package `packages/content` (Dockerfile copies its manifest; the runtime image does not need it yet).
- `core` gains `schema/content.ts`, `generator/`, the `placeholder` widget, `GeneratorInfo` on screens, the `meta`
  op's `generator`, `lockedParts`/`sameValue` and lock-safe `remove`/`replace` under `respectLocks`, inline
  `byState` on ambient bindings, and lint rules for placeholders and unknown states in `byState`.
- Theme manifests gain `tones` (defaults provided, LCARS sets its own).
- Phase 5 MCP tools (`generate_screen`, `generate_suite`, `regenerate`, `list_recipes`, `list_blocks`) can wrap
  `generateScreen`, `generateSuite`, `regenerateOps` and the content package directly.
