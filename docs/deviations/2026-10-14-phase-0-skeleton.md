# Deviation: Phase 0 keeps v1 under legacy/ and runs the server without a build

## Date
2026-10-14

## Original Plan
Section 18.1: "Tag the current code as `v1`, remove it in the Phase 0 PR so nothing from it leaks into the new
structure." Section 5.2 lists `core/schema/…` folders and a server that is built like the other packages.

## What Changed
1. The v1 code, tests, data and docs were moved to `legacy/` (with `git mv`) instead of deleted. The workspace,
   lint, typecheck, knip and Docker all ignore that folder. The `v1` tag has not been pushed.
2. The server and `core` are not compiled: Node (≥ 22.18; 24 in Docker) runs the TypeScript sources directly
   with type stripping. Relative imports carry `.ts` extensions and only erasable syntax is allowed
   (`erasableSyntaxOnly`).
3. The stack layout has `direction` and `gap` only (as in the plan's node model); an `align` option was tried and
   dropped because widget slots are size containers that must fill their share.
4. Widget definitions carry an `example` (valid sample props) in addition to the fields in section 7.1.

## Justification
1. Deleting the old tree in an automated session was blocked as an irreversible local change; moving it is
   reversible and still keeps v1 out of the new structure. Deleting `legacy/` and pushing the `v1` tag are
   one-line follow-ups once the owner confirms.
2. No build step for the server means one less moving part in development, CI and the Docker image.
3. Alignment inside a slot belongs to the widget renderer, not the container.
4. Examples feed contract tests, previews and AI prompts from one place.

## Impact
- Phase 1+ code must keep `.ts` import extensions and erasable syntax in `core` and `server`.
- `legacy/` can be removed at any point without touching v2.
