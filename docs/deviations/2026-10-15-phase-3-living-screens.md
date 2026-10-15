# Deviation: Phase 3 runs display navigation on the server, synthesises theme sounds and trims a few actions

## Date
2026-10-15

## Original Plan
Section 17, Phase 3: data widgets (readout, gauge, bar-graph, sparkline, status-light/matrix, data-cascade,
data-grid, clock, alert-banner, button-group, toggle, slider, image, video); signals (ambient and shared), bindings,
per-state overrides; display actions (navigate, back, setState, setSignal, video, sound). Section 6.3 sketches the
signal sources (`static`, `walk`, `wave`, `clock` with `time | stardate | countdown`, `manual` with no fields) and
actions including `toggle`, `video` with `play | pause | seek | load` and `cue`, and calls navigate and back "local
to the display". Section 18.4 recommends that only buttons explicitly marked for it change show-wide state. The
Phase 2 deviation moved the operator's video transport and signal sliders to this phase.

## What Changed
1. **Navigation runs on the server.** A press goes to the server, which keeps a back stack per display in memory
   and sends that display a new snapshot. The operator sees where a display's buttons took it ("On Ship
   schematic") and can send it back; a new assignment, a draft preview or forgetting the display clears the stack.
   The stacks do not survive a server restart.
2. **Show-wide actions have a switch.** `setState` and `setSignal` run only from buttons that carry them, and only
   while the show setting `displayGlobalActions` is on (default on). The operator console has the switch, so a
   stray tap during a take can be ruled out. Navigation, video and sound always work.
3. **Not built: `toggle` (local highlight), `cue`, video `seek` and `load`, and the clock's `countdown`.** Video
   commands are `play`, `pause`, `toggle` and `restart`. Clock formats are `time`, `date` and `stardate`.
4. **Manual signals have a range.** `{ kind: "manual", initial, min, max, step }`, so the operator's slider and
   relative changes (`delta`) have limits. Values are clamped and snapped to the step.
5. **Theme sounds are synthesised** with Web Audio from short step lists in the theme manifest, not audio files.
   The base theme has `press`, `confirm`, `warning` and `alert`; LCARS overrides `press` and `alert` (its klaxon)
   and adds `hail`. States name a sound (`yellow-alert` plays `warning`, `red-alert` plays `alert`). Sounds are
   **off by default** (`settings.sounds`), because film sets record sound separately.
6. **Signals are edited in a dialog in the screen library** (name, id, unit, shared or ambient, source and its
   numbers). Per-state ranges (`byState`) are kept but edited in `show.json` for now.
7. **The inspector gains field types** for props that are not one plain value: a number-or-text value, lists (one
   per line), numbers (comma separated) and tables (one row per line, cells split by `|`), all derived from the
   schema like the others.
8. **Thumbnails stand still.** Operator, library and template thumbnails freeze time, pause CSS animations and do
   not autoplay video, so a page of them stays cheap; shared values still move in them.
9. **Protocol 4.** Snapshots carry the show's signals, the sounds setting, shared values and `navigated`; the
   overview carries shared values, and each display's `navigated` screen and the `videos` on what it shows (for
   the operator's transport controls). New events: `signals`, `video` and `press`.
10. **The image widget** was already added in Phase 2; this phase adds the other 14.
11. **The demo video is VP9 WebM**, not H.264 MP4. Open-source Chromium builds, including many kiosk images and the
    one Playwright tests with, cannot play H.264. Muted video autoplays in every browser; theme sounds need either
    a first touch on the display or the kiosk flag `--autoplay-policy=no-user-gesture-required`.

## Justification
1. Only the server knows which screens are published and what each display shows; going through it keeps
   displays, the operator console and draft previews consistent, and lets the operator undo an actor's detour.
2. The plan's decision 18.4 asks for explicit marking: the actions are that marking, and the switch adds a single
   place to turn all of them off during a take.
3. None of these is needed for the exit criterion; local toggles and cues belong with Phase 6's show tooling, and
   seek and load need a timeline UI that does not exist yet.
4. A slider needs a range, and a "hull -39" action needs a floor.
5. Synthesised sounds need no files, work offline, cost nothing to ship and can be designed per theme in the
   manifest; Phase 6 can add recorded sound packs.
6. A show's signals are show-wide, not per screen; the library is where show-wide things live in the editor.
7. Data widgets need lists and tables; a JSON field would be hard to use for crew.
8. Dozens of live screens in one page would be slow and distracting.
9. The displays and tools need these fields; the protocol version makes old clients reload.
10. Assets needed something to show in Phase 2.
11. VP9 plays everywhere the displays run.

## Impact
- `AGENTS.md` and the widgets, themes and server skills describe signals, bindings, actions, sounds and the new
  protocol.
- Phase 4 recipes can bind generated widgets to ambient sources and give navigation buttons `navigate` actions.
- Phase 6 adds cues, local toggles and recorded sound packs on top of the same action and sound model.
