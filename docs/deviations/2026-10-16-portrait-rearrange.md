# Deviation: screens rearrange on a display turned the other way

## Date
2026-10-16

## Original Plan
Section 9 of the plan makes layouts fluid: a `fluid` screen "re-flows to the real aspect" through `fr` tracks,
stack weights and `--u`, and `contain` letterboxes. The generator leans towards stacked archetypes for a 9:16
profile (section 11). Nothing moves parts around when a display's shape differs from the screen's design, so a
16:9 screen on a portrait panel kept its nav column and side panel and its rows of panels were squeezed.

## What Changed
1. **Orientation.** A screen's design orientation comes from `profile.aspect` (9:16 is portrait, the rest are
   landscape). A display measures its own box (`ResizeObserver` on the screen), so turning a panel or resizing a
   window rearranges it live. The editor preview takes the orientation from its aspect buttons.
2. **Automatic rearranging** (`core/tree/turn.ts`, `turnTree`), when the two orientations differ:
   - Frames draw portrait chrome in every theme (LCARS, HUD, Terminal, base): the nav column becomes a band under
     the title, the aside moves below main, the console's side panel goes to the bottom. `slotDirection` says
     which way each slot runs; nav and aside are rows in portrait.
   - The outermost row of panels on each path becomes a column; rows of only buttons, toggles and lights stay rows.
     Parts below a rearranged one keep their design, because it gave them their width back.
   - Grids turn on their side (columns become rows, cells and spans move with them) when they are at least as wide
     in cells as they are tall; a one-column grid stays standing.
   - A lone panel in a band (the dashboard's aside in portrait) is laid along the band, keeping its heading on top.
   - The reverse holds for a portrait screen on a landscape display: columns become rows, bands become columns.
3. **Overrides.** `profile.rearrange` (default true) turns it off per screen. Any node can carry
   `turned: { arrange?: "auto" | "keep" | "row" | "column", hidden?: boolean }`: `keep` leaves it (and, for a
   frame, its chrome) as designed, `row`/`column` set a stack's or grid's direction outright (validation allows
   them only there), `hidden` drops it only on a turned display. The `set` op carries `turned`; MCP's guide
   explains it.
4. **Editor.** The 9:16/16:9 preview buttons show the rearranged screen with a note; there the preview only
   selects (drag, resize and quick layout tools work on the designed arrangement). The inspector gains an
   "On a portrait display" (or landscape) section, the screen settings a "Rearrange" checkbox.

## Justification
R asked that a horizontal-to-vertical change restructure the layout rather than stretch it. An automatic rule
keeps every existing and generated screen working on a turned panel with no extra authoring, and the per-node
`turned` settings give control where the rule guesses wrong without keeping two copies of a screen in sync. A
whole second portrait tree per screen was considered and rejected for that reason.

## Impact
- No schema version bump: `rearrange` and `turned` are optional with defaults, so older documents read unchanged.
- Portrait-designed screens (9:16) now draw portrait chrome on portrait displays (nav as a band); before, the
  frames always drew their landscape chrome.
- Grid drops and handle drags are disabled in a turned preview, since cells there are transposed.
- The rearranged tree only exists at render time; the one node it adds (the row under a panel's heading in a band)
  carries the panel's id, so clicking it in the editor selects the panel.
