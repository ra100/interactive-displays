# Deviation: Phase 1 renders per-state overrides early and keeps the protocol display-only

## Date
2026-10-14

## Original Plan
Section 17, Phase 1: full node model, `defineWidget` registry, ops and revisions, structural lint, typed protocol,
display identity and assignment, show-defined states with theme effects, persisted runtime state, the LCARS theme,
`/gallery` and contract tests. Exit criterion: "adding a widget touches one core file (+ optional renderer)".
Phase 3 lists "per-state overrides". Section 12.1 has displays request fullscreen and a wake lock and hide the
cursor. Section 12.2 has `hello { role: 'display' | 'builder' | 'operator', displayId?, token? }` and rooms
`display:<id>`, `screen:<id>`, `operators`, `builders`. Section 6.2 allows a theme's extra named swatches
(LCARS `tan`, `salmon`) besides the eight tone roles.

## What Changed
1. **Per-state overrides render now.** The node model's `when` entries are validated, linted and applied by the
   runtime (`nodeInState` in `core`), so red alert changes text, tones and visibility on the demo screens.
2. **Protocol stays display-only.** `hello` accepts `role: 'display'`; the server uses `display:<id>` rooms and
   finds the displays showing an edited screen by resolving assignments. Operator and editor roles, tokens and
   the other rooms arrive with their clients in Phase 2.
3. **A base renderer is still required** for every widget. Adding a widget touches its definition file, the
   `widgets` map in `catalog/index.ts`, and a base renderer; theme renderers stay optional.
4. **Kiosk behaviour** (fullscreen, wake lock, hidden cursor) is not in this phase; Phase 6 lists "PWA/kiosk
   polish" and it lands there.
5. **No named swatches beyond tone roles.** LCARS maps its palette onto the eight roles.
6. **Additions:** a display can preview another look with `/d/<id>?theme=base&variant=nemesis`, and the REST
   adapter (`/api/catalog`, `/api/show`, `/api/screens`, `/api/state`, `/api/displays`) exists ahead of the
   editor and operator console that will use it.

## Justification
1. States need something visible besides colour to be testable on set, and the node model already carries
   `when`; rendering it is a few lines and needs no signals.
2. Shipping roles and rooms without the clients that use them would be untested surface.
3. The compiler-enforced base renderer is what guarantees that every screen renders in every theme.
4. Fullscreen on first tap gets in the way while testing in a desktop browser; it belongs with the kiosk work.
5. Roles keep screens portable between themes; swatches can be added when a theme needs one.
6. The preview parameter is the cheapest way to show "the same screen in `base`" on real hardware; the REST
   adapter lets the crew drive states and assignments with `curl` until the operator console exists.

## Impact
- Phase 2 adds operator and editor roles to `hello`, auth tokens and the `operators`/`builders` rooms.
- Phase 3 keeps `when` as is and adds signals and bindings beside it.
- The widgets skill and `AGENTS.md` describe the three touch points for a new widget.
