# Deviation: scripted interactions between displays

## Date
2026-10-17

## Original Plan
Display actions run where they are pressed (navigate, back, video, sound) or show-wide (setState, setSignal,
cue). A beat that spans several displays is a cue the operator runs, or a display button that runs that cue.

## What Changed
1. **Targets.** navigate, back, video and sound take `on`: `self` (the default and the old behaviour), `others`,
   `all`, or `{ displays, screens }` (named displays, and any display showing a named screen when it runs).
2. **Trigger.** A new `trigger { target, on }` action uses a control on other displays by node id: it flashes
   there and runs its own actions as if touched there. Triggers nest at most three deep.
3. **Delays.** Every action takes `after` (seconds, 0–600). The server schedules it; at most 64 wait at once, and
   they are dropped when the cues go back to the top or the server stops.
4. **Protocol 5.** Displays receive `sound { sound }` and `trigger { nodeId }`. Renderers flash a control on a
   `MediaBus.flash(nodeId)`, through `usePressFlash(nodeId)`.
5. **Editor.** Every action has Runs on and Wait (seconds); triggers pick a control from the screens they reach.
6. **Demo show.** Tactical's Photon torpedoes button replays the viewscreen and, 1.5 s later, sends Engineering
   to the master systems display with the alert sound.

## Justification
On a film set an actor's tap on one console often has to make something happen on another (a hit lands on the
viewscreen, engineering shows the damage), timed to the action, without the operator pressing GO at exactly
that moment. Cues stay the operator's running order; these let a screen carry its own small script.

## Impact
- Screens without `on` or `after` behave exactly as before; no migration.
- Reaching another display is show-wide, behind the existing `displayGlobalActions` setting.
- Displays on protocol 4 reload once to get the new bundle.
- Delayed actions are not persisted and not shown on the operator console yet.
