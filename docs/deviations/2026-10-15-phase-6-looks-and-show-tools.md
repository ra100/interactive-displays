# Deviation: Phase 6 ships two new looks, 4K sizing and lighter sound packs

## Date
2026-10-15

## Original Plan
The Phase 6 row of section 17 includes:

- a second theme pack, whose direction was still to be chosen, with frames, renderers, decor, sounds and its own
  content pack;
- decor mapping on theme switch;
- cue lists;
- sound packs;
- PWA and kiosk polish.

The exit check is: "An existing show re-skinned to the new theme looks native, and generated screens in that
theme look designed for it." Section 8 has a `{ do: 'cue' }` action listed under "later". Section 13 lists a
display setup guide that includes adding to the home screen (PWA).

## What Changed
1. **Two new theme packs instead of one.**
   - R chose the translucent HUD (`hud`, "Holo HUD") on the decision card.
   - The CRT terminal (`crt`, "Terminal") was built while that choice was open and is kept as a third look.
   - Each has its own content pack: `corvette` for the HUD and `freighter` for the CRT.
2. **Decor mapping lives in the manifest.**
   - A theme can map another theme's decor kind to one of its own pieces. For example, `decorStandIns: { "lcars.bar": { kind: "hud.scale" } }`.
   - `defineTheme` checks each mapping.
   - Decor with no mapping is still hidden, as before.
3. **Content packs name their theme.** `ContentPack.theme` is optional. The Generate dialog lists the packs written
   for the show's theme first.
4. **Re-skinning is an operator control.**
   - It is `PUT /api/show/theme` and the MCP tool `set_theme`, which needs "AI may run the show".
   - The operator console has a **Look** section for it. It is not part of the editor's screen settings.
5. **New: sizing for 4K panels.** R gave this requirement during the phase: the panels are 4K and 80 to 100 inches.
   - `show.scale` defaults to 0.7. There is also `display.scale` and a `scale` on each node, set with the `set` op.
   - The show scale can be set over REST, from the operator console and with the MCP tool `set_scale`.
   - Buttons and toggles in stacks keep a button's height instead of filling their cell.
   - In previews, the touch minimum now matches 60 px on a 4K panel (2.8% of the shorter side), not on a 720p panel.
   - The generator starts dense when the show is drawn below 80%.
6. **Cues are a show-level running order.**
   - Each cue has a state, signal values, screen assignments (`null` means the default screen) and video commands.
   - REST: `GO`, run, reset and define. MCP: `set_cues`, plus `run_cue`, which needs "AI may run the show". The last cue run is kept in `runtime.json`.
   - The `{ do: "cue" }` action from section 8 is included. It is a global action, gated by `displayGlobalActions`.
   - There is no timed auto-follow (one cue starting the next after a delay).
7. **Sound packs are another theme's synthesized sounds.**
   - `show.soundPack` is chosen in **Look → Sounds**.
   - Uploaded audio files as sounds are not part of this phase.
8. **Kiosk polish is client-side only.**
   - A web app manifest with no `start_url`, so an installed display opens on its own `/d/<id>`.
   - A wake lock, hiding the cursor after 3 seconds, no long-press menu, and fullscreen with `F` or `?fullscreen`.
   - There is no service worker or offline cache.

## Justification
- Keeping the finished CRT costs nothing at runtime and proves the theme contract a third time. It also gives
  R's productions a second alternative look.
- Mapping decor in the manifest keeps the knowledge inside the theme that draws it. Screens stay theme-neutral,
  and a new theme can adopt LCARS screens without editing them.
- Re-skinning changes what every display shows at once. That makes it a show control like state, so it belongs
  with the operator and behind the AI live-control switch.
- Scale follows the screen unit `--u`, so every theme, frame and widget responds without per-theme changes. Most
  font sizes were already capped by `--u`; the LCARS header title was the exception and is now capped too.
- Uploaded audio needs new asset types, decoding and a mapping UI. Sets record their own sound and sounds are off
  by default, so another theme's pack covers the stated need with no new storage.
- A service worker would cache the app shell, but a display is useless without the server. Reconnection already
  keeps the last screen up.

## Impact
- Older show files load with `scale: 0.7`, so existing screens look smaller than before on the same display. The
  operator can set 100% to get the old size back.
- Screenshots taken on earlier phases were taken at the old size (1:1).
- Cue screen changes write `show.json`, as assignments always have.
- `DisplaySnapshot.display` now always carries `scale`, and `ShowOverview` carries `cue`. The protocol version is
  unchanged, because both fields are additive.
