# Deviation: buttons are sized in real centimetres, and LCARS gains two layouts

## Date
2026-10-16

## Original Plan
Section 6 of the plan sizes everything from `--u` (1% of the display's shorter side) and asks for touch targets
of at least 60 px. Phase 6 added the show's scale (70% by default) for 4K panels. The plan names three
archetypes: `sidebar`, `header-main` and `dashboard`.

## What Changed
1. **Physical panel size.** A show has `panel: { inches, buttonCm }` (90" and 1.5 cm by default) and a display can
   name its own `inches`. Snapshots carry the resolved panel. `PUT /api/show/panel`, the display's `inches`, the
   MCP tool `set_panel` and the operator's **Panel** and **Buttons** pickers change it.
2. **`--cm` and `--touch`.** The runtime works out one real centimetre from the frame's diagonal and the panel's
   inches. `--touch` is now a button's height (`buttonCm` centimetres, times any node scale) instead of a fixed
   60 px. Buttons, toggles, button groups and toolbar rows use it; buttons in a row are at most eight button
   heights wide.
3. **Touch targets are 1 cm or more** on the show's panel, replacing "60 px or more". The e2e checks measure
   buttons at 3840×2160 against the panel's centimetre.
4. **Two archetypes**, `split` (title, aside, nav, main, status) and `console` (all six slots), drawn by every
   theme. The trek recipes give them weights.
5. **LCARS additions**: `lcars.segments` and `lcars.scan` decor, era variants `ds9`, `voyager` and
   `lower-decks`, lamp rows for the status matrix, and two demo screens (Operations, Long range sensors) on new
   displays `ops-1` and `science-1`.

## Justification
R asked for buttons about 1 to 2 cm tall on the set's 80–100" 4K panels. On such a panel 60 px is 2.8 to 3.5 cm
and the old `max(60px, 6u)` came to 5–20 cm, because `--u` grows with the panel's pixels, not its size. Only the
panel's real size can turn centimetres into pixels; a 90" default keeps 1.5 cm buttons between 1.33 and 1.67 cm on
any 80–100" panel without configuration. The new layouts and decor come from the LCARS references R asked for
(`docs/reference/lcars.md`).

## Impact
- Buttons on existing screens get much smaller on large panels; the rest of each screen is unchanged. Screens
  designed around big buttons have more empty space; Size 50% balances denser screens.
- Previews and thumbnails scale buttons down with everything else (the old fixed preview minimum is gone).
- Themes must use `var(--touch)` for pressable heights instead of `max(var(--touch), N * var(--u))`.
- Older shows load with the 90"/1.5 cm default; no migration is needed.
