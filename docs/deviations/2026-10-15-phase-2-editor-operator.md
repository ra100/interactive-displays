# Deviation: Phase 2 moves video and signal controls to Phase 3 and adds drafts with live edit

## Date
2026-10-15

## Original Plan
Section 17, Phase 2: outline/slots/canvas editing, schema-driven inspector, profile previews, locks, revisions and
revert, drafts and publish, send-to-display preview, screen library, assets; `/operator` with data-driven
states, display list, assign, identify, **video**, blackout, QR codes. Section 12.3 also lists "pinned shared
signals as sliders". Section 13 shows Library tabs for widgets, blocks, LCARS decor and shapes, and drop targets
in the preview. Section 14 lists `screens/` and `.history/` but no separate published copy. Section 16 says
`EDITOR_TOKEN` "protects editor, operator writes and MCP". Sections 11.3 and 15 mention an audit log.

## What Changed
1. **No video transport or signal sliders on the operator console.** There is no video widget and there are no
   signals yet; both arrive in Phase 3, and their operator controls land with them.
2. **The image widget arrives now** (planned for Phase 3), so uploaded assets have something to show. Video files
   can be uploaded already.
3. **Drafts and published copies are stored apart.** `screens/<id>.json` is the draft; `published/<id>.json` is
   what displays show. Screens move to `schemaVersion: 2` with a `published` revision number; version 1 files are
   upgraded on read and count as published.
4. **Live edit (rehearsal mode)**, an addition: a show setting that publishes every saved edit at once. The editor
   asks before turning it on and hides Publish while it is on.
5. **Draft previews are not persisted.** "Send to display" lasts until it is ended, the screen is deleted or the
   server restarts.
6. **The editor token guards writes only.** Every API write and the operator and builder sockets need it; reads
   (`GET /api/...`) and displays do not. A link with `?token=` stores it in the browser, for QR codes.
7. **No audit log yet**; it moves to Phase 5, where AI edits make it necessary.
8. **The Add panel has Widgets, Layouts, Decor and Assets.** Blocks arrive with the content pack (Phase 4) and
   shapes with AI authoring (Phase 5). New parts are dropped into the outline (or clicked to insert at the
   selection); the preview handles selection and canvas move and resize, not drops.
9. **Profile previews** cover 16:9, 16:10, 4:3, 21:9 and 9:16, the aspects a screen can declare.
10. **Revision times** come from the history files: saving revision N archives revision N-1, so that file's time
    is when N was saved. Revision 0 has no earlier file and shows no time.
11. **Tool UI** (operator, library, editor) has its own neutral dark style, independent of the show's theme, with
    60 px touch targets on the operator console.

## Justification
1. Controls for things that do not exist yet would be untestable; Phase 3 builds them together.
2. Asset upload with nothing to use it would be dead weight; the image widget is small and reuses the catalog.
3. Publishing must never be a side effect of editing during a take; separate files make the on-air copy obvious
   on disk and survive restarts.
4. Rehearsals want edits to show up on set without pressing Publish each time.
5. A preview is a short-lived look at a draft; restoring one after a restart would surprise the crew.
6. Displays must keep working without a token, and status reads are harmless on a closed set network.
7. With one or two people editing, revisions already record what changed.
8. Blocks and shapes are data that does not exist until those phases; dropping into the outline is precise in a
   deep tree, while preview drops would need slot hit-testing for every theme's frames.
9. Previews should match every display a show can declare.
10. The history keeps whole documents; save times come free from the files without another index.
11. The tools are used in daylight on phones and laptops; a themed UI would change with every show.

## Impact
- Phase 3 adds the video widget and operator transport, signals and their sliders, and keeps the image widget.
- Phase 5 adds the audit log next to MCP and token scopes.
- `AGENTS.md` and the server skill describe drafts, the `published/` folder, live edit, previews and the token.
