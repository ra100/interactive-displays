// The design rules an AI client reads before it edits screens (resource interactive-displays://guide).
export const DESIGN_GUIDE = `# Designing screens for Interactive Displays

Screens drive the displays on a film set. A screen is a tree: containers lay out children, widgets show things,
decor is theme-only ornament. Documents store meaning; the theme decides the look.

## Start from generation
- Prefer generate_screen over building by hand: it picks a layout, fills it from a section recipe, wires live
  values and red-alert behaviour, and always validates. Then adjust with apply_ops.
- regenerate rebuilds everything that is not locked; pass nodes to reroll single panels. Lock what you like first
  with a set op ({"op":"set","id":"…","locked":true}).
- A placeholder widget ({"kind":"placeholder","props":{"intent":"torpedo loading controls"}}) is filled with a
  matching panel by the next regenerate.

## Layout
- The root is usually a frame: an archetype (sidebar, header-main, dashboard, …) with named slots (title, nav,
  toolbar, main, aside, status). Children choose a slot with "slot". get_theme lists the layouts and their slots.
- Inside slots use stack (direction, gap, child weights), grid (columns/rows and areas) or canvas (normalised rects).
- Keep it readable from across a room: at most 8 buttons in a stack, short labels (nav ≤ 18 characters).

## Colour and look
- Never write colours. Use tone roles: primary, secondary, accent, info, success, warning, danger, neutral.
- Show states (normal, red-alert, …) restyle every display. Override props or visibility per state with "when":
  [{"state":"red-alert","props":{"tone":"danger"}}] or [{"state":"normal","hidden":true}].

## Live values
- Bind a widget prop to a signal: "bind": {"value": {"signal": "warp-output"}} for a show signal, or an ambient one
  that each display works out locally: {"ambient": {"kind": "walk", "min": 40, "max": 60, "volatility": 0.3}}.
  Per-state ranges go in "byState".

## Controls
- Buttons, toggles, sliders and button groups carry "actions": navigate/back (that display only), setState,
  setSignal and cue (show-wide), video, sound. Only point at states, signals, cues and screens that exist.

## Sizing
- Target panels are large 4K screens; the show draws everything at its scale (70% by default) and a display can
  have its own. To make one part larger or smaller than the rest, use the set op with scale (0.25–4).
- Buttons are sized in real centimetres from the show's panel (90" and 1.5 cm by default), not by scale, so they
  stay fingertip-sized on a 100" panel. Leave room for them rather than making them weight-filled walls of colour.

## Portrait and landscape
- A screen is designed for its profile.aspect. On a display turned the other way (a 16:9 screen on a portrait
  panel, or the reverse) it is rearranged, not stretched: frames draw portrait chrome (the nav column becomes a
  band under the title, the aside moves below main), rows of panels become columns and grids turn on their side.
  profile.rearrange false keeps the designed arrangement. Per part, set {id, turned: {arrange?, hidden?}}: arrange
  "keep" leaves it as designed, "row"/"column" set a stack's or grid's direction outright, hidden drops it there.

## Editing safely
- Every edit is a list of ops applied all or nothing against the screen's revision (baseRevision). On a 409, call
  get_screen again and rebuild the ops. Locked nodes cannot be changed or removed through MCP.
- Ops: insert {parent, index?, child: {node, slot?, weight?, area?, rect?}}, remove {id}, move {id, parent, index?},
  update {id, props} (shallow merge), set {id, locked?, hidden?, when?, scale?, turned?, bind?, actions?} (null removes),
  place {id, slot?, weight?, area?, rect?}, layout {id, layout}, replace {id, node}, meta {name?, section?, tags?, profile?}.
- Check your work with lint_screen and get_screen (format "outline" is compact). Displays show the published copy:
  edits land in the draft until someone publishes.
`;
