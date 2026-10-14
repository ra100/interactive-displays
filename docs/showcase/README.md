# Showcase

What each phase of the v2 rebuild looks like. Screenshots are captured by `tests/e2e/showcase.spec.ts`
against the real server and built app (`pnpm build && SHOWCASE=phase-N pnpm test:e2e showcase`).

## Phase 0: walking skeleton

A single server process serves the display app. A display opens `/d/<id>`, says hello over Socket.io and renders
the screen it is assigned, here the hand-written demo screen in the neutral `base` theme. Nothing is LCARS yet;
that arrives in Phase 1 as a theme pack, without changing this screen document.

**The same screen document on three display shapes.** Layout is fluid: stacks share space by weight and type
scales with the display, so nothing is positioned in pixels.

| 16:9 TV | 4:3 tablet | 9:16 portrait |
|---|---|---|
| ![16:9](phase-0/welcome-16x9.png) | ![4:3](phase-0/welcome-4x3.png) | ![9:16](phase-0/welcome-9x16.png) |

**Server restart during a take.** The display keeps its last screen and shows a small badge in the corner
until the server is back, then reconnects on its own.

![Reconnecting](phase-0/reconnecting.png)

**Mistyped display address.** Ids are short, lowercase and path-safe; anything else gets a clear message.

![Invalid id](phase-0/invalid-id.png)

### Under the hood

- Screen document: [`packages/server/seed/shows/demo/screens/welcome.json`](../../packages/server/seed/shows/demo/screens/welcome.json)
- Widget catalog: `title`, `text`, `button`, each one `defineWidget()` file in `packages/core/src/catalog/`
- Theme: `base` (`packages/themes/src/base/`), the fallback every future theme builds on
- Docker image with a persistent `/data` volume; CI builds it and checks that data survives a restart
