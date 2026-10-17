---
name: content
description: Add or change content packs (ship sections, recipes, blocks, vocabulary) in packages/content, or change the screen generator in packages/core/src/generator. Use when adding a section such as Hydroponics, tuning how generated screens look, or touching Generate, Regenerate or Reroll.
---

# Content packs and the generator

A content pack is data: `packages/content/src/<pack>/` holds `vocab.json`, `blocks.json` and one
`recipes/<section>.json` per section, joined in `pack.ts` and checked against `ContentPackSchema`
(`packages/core/src/schema/content.ts`) when `@interactive-displays/content` loads. The generator lives in
`packages/core/src/generator/` and is pure: same options and seed, same screen.

## Adding a section

1. Copy a recipe that feels close (`engineering.json` for machinery, `medical.json` for monitoring).
2. Fill in:
   - `id` (also the screen's `section`), `label`, `code` (2–4 capitals, shown as `ENG 04-7731`).
   - `archetypes`: weights for `sidebar`, `header-main`, `dashboard`; leave out a layout to never pick it.
   - `titles`, `nav` (3–10 labels, at most 18 characters), `status` lines.
   - `systems` (2–10). Each has readings (`metrics`) with a resting `range` and, when an alert should move it,
     an `alertRange`; `motion` (`walk` or `wave`); `prefer` (`gauge`, `readout`, `sparkline`); `precision` for
     counts (`0`); `signal` to follow a show signal when the show has it. Buttons (`actions`) can be `danger` and
     carry real actions (`setState`, `setSignal`, `sound`); actions the show cannot run are dropped when
     generating. `notes` are lines of technobabble; `short` is the nav label when `label` is long.
   - `alert.emphasise`: reading ids that turn danger and flash in an alert; `alert.status`: alert status lines.
   - `blocks.prefer` / `blocks.avoid`: block ids.
3. Add it to the `recipes` list in `pack.ts`.
4. `pnpm --filter @interactive-displays/content test`. The property tests generate every section for random seeds,
   densities, shapes and layouts and check it is valid, lint-clean against the demo show, deterministic and keeps
   locked parts. Then look at it in `/builder` → Generate, in every state.

## Blocks

A block's `layout` is a tree of parts the generator fills from one system, using its readings and buttons in
order (a panel never repeats a reading): `heading`, `metric` (next reading as one of `show`), `metrics` (up to
`max`), `lights` (a status light per reading), `actions` (up to `max` buttons), `ambient` (busy filler),
`notes`, `log` (a coded table), `clock`, and `stack` (`direction`, `children`). `weight` sizes a part against its
siblings. `fits` (`main`, `aside`), `size` (`large` goes first in the main grid), `needs` (readings and buttons a
system must have) and `tags` (matched against placeholder intents) decide when it is picked.

Keep buttons per stack small (the property test allows 8) and labels short; lint flags long labels.

`ship-schematic` as an instrument follows the section: in `tactical` it binds shields and arms in an alert, in
`engineering` it binds power, elsewhere it is a plain schematic; a system whose id is a ship system (`deflector`,
`shuttlebay`…) is highlighted, and a state with the `damaged` effect turns it to damage control.

## Changing the generator

- `generate.ts`: layout choice (`archetypeWeights`), chrome (title, nav or toolbar, status line, alert banner),
  the main grid (`gridPlan`), locked parts and placeholders (`keptFrom`), variants, suites, `regenerateOps` and
  `rerollOps`.
- `blocks.ts`: parts to widgets, bindings with `byState` for alert states, tones.
- `context.ts`: ids, codes, phrases, which actions a show can run, alert and banner states.
- Every random choice goes through the seeded `Random` from `random.ts`; use `fork(label)` for an independent
  stream so changing one part does not reshuffle the rest. Never use `Math.random` in the generator.
- Tests: `generate.test.ts` (fixture pack) and `packages/content/src/packs.test.ts` (the real pack), plus
  `tests/e2e/generate.spec.ts` (touch sizes on a real display, red alert, suites).
