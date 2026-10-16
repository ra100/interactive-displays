# Deviation: instrument widgets and nested panels

## Date
2026-10-16

## Original Plan
The plan's catalog covers general widgets (readouts, gauges, bar graphs, status matrix, data cascade, buttons)
and ornament comes from frames at the screen's edge and theme decor. Content pack parts are heading, metric,
metrics, lights, actions, ambient, notes, log, clock and stack.

## What Changed
1. **Eleven widgets** in three new categories: `scan` (waveform, spectrum, globe, scan-progress), `tactical`
   (shield-status, weapons, target-lock) and `navigation` (heading, speed-ladder, star-chart), plus `reactor`
   in data. Each has a base renderer and LCARS, HUD and terminal styling.
2. **`panel` archetype** (title, main, status) meant to be nested inside another layout. It is not offered as a
   whole-screen archetype (`SCREEN_ARCHETYPE_IDS`), so generation and the REST create call skip it.
3. **`layout.variant`** on frame layouts, an optional short name the theme reads; panels use it for their shape
   (`PANEL_SHAPES`). Without it the theme picks a shape from the node id.
4. **Content packs**: systems list `instruments`; new parts `instrument` and `panel`; blocks can need
   instruments. New blocks (instrument-panel, instrument-pair, instrument-aside, panel-gauges, scope-strip).
5. **Demo screens** `weapons-control`, `conn` and `astrometrics`.

## Justification
R asked for more elements (graphs, scans, weapons control, navigation) taken from references, and for LCARS
shapes that flow through the page rather than only bordering it. Purpose-built instruments read correctly at a
glance on set, which a gauge relabelled as "shields" does not. A nested frame reuses the frame machinery (slots,
theme renderers, fallbacks) instead of adding a parallel decor system.

## Impact
Older screens and packs are unchanged: every new field is optional or defaults to empty. Themes without a panel
renderer fall back to the base one. Screens with panels render in every theme.
