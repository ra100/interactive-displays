---
title: "refactor: Interactive Displays v2 — platform rework (themes, one-click generation, AI/MCP)"
type: refactor
date: 2026-10-14
status: proposed
supersedes: "Architecture sections of docs/plans/2026-02-04-feat-lcars-interactive-display-system-plan.md (phases 1–4 stay as history)"
---

# Interactive Displays v2 — Platform Rework

> **Status:** design proposal for review. Nothing in this document is implemented yet.
> Comment on the PR; decisions that need an owner call are collected in [§19](#19-decisions-needed).

## 1. Summary

The v1 system works: one server, 6–15 displays, an operator panel, a drag-drop builder, LCARS shapes.
But every requirement for the next stage — swap the whole look, generate a sensible screen in one
click, let AI fill or edit screens — runs into the same root problem: **v1 stores pixels-and-shapes,
not meaning.** A layout is a flat list of LCARS shapes with hex colours at fixed 60 px grid cells, so
there is nothing a different theme, a generator, or an AI can reason about.

The rework separates **what is on a screen** (semantic widgets: a nav list, a readout, a gauge, a data
cascade) from **how it looks** (a theme pack that renders those widgets, adds its own chrome and
decoration, and defines what "red alert" means visually).

Key decisions:

1. **One document model, one schema source.** A screen is a small tree of layout containers and
   widgets, defined with Zod in a new pure-TypeScript `core` package. The same schema produces the TS
   types, server validation, the builder's property panel, MCP/AI tool schemas and contract tests.
   Adding a widget becomes one definition file plus (optionally) one renderer per theme.
2. **Theme packs, not colour sets.** A theme provides tokens *and* renderers, frames (screen chrome
   with named slots), theme-only decoration primitives (LCARS elbows and bars), state effects, fonts
   and sounds. A neutral `base` theme renders every widget, so a new theme only overrides what it wants.
   Layouts store colour *roles* (`primary`, `accent`, `danger`), never hex.
3. **Fluid, resolution-independent layout.** Screens re-flow to any display aspect instead of
   rendering a 768 px-wide grid in the corner of a 4K TV.
4. **Deterministic one-click generator.** Pick a section (engineering, environmental, weapons…) →
   a seeded generator combines a *section recipe* (vocabulary, metrics, actions), a *layout archetype*
   and reusable *blocks* into a complete, editable, touch-safe screen. Reroll, lock parts, regenerate
   the rest, or generate a whole linked suite of screens for a station. Works offline, costs nothing.
5. **AI on top, through one command layer.** Every change (builder, operator, generator, AI) is a
   validated operation applied by the server. An **MCP endpoint** exposes those same commands so
   Claude (or any MCP client) can read, generate, edit, and create reusable elements; an optional
   built-in "Fill with AI" button uses the same tools. Drafts vs published screens keep AI and
   editors from changing a display mid-take.
6. **One process, one port, one container.** The server serves the built app, the API, Socket.io and
   MCP. `docker run -v ./data:/data -p 3010:3010 …` is the whole deployment; fonts are self-hosted so
   nothing needs the internet on set.
7. **Phased delivery** ([§18](#18-roadmap)) where each phase ships something usable: deployment first,
   then the core model with LCARS ported, then builder/operator, live data, the generator, AI/MCP,
   and finally a second, completely different UI family.

## 2. Goals and non-goals

| # | Goal (from the request) | How this design meets it |
|---|---|---|
| G1 | **Maintainable** | One schema source; widget registry instead of switch statements in 6 files; pure `core` package with most logic unit-testable; generated contract tests for every widget × theme. |
| G2 | **Easy to manage** | Shows (productions) as folders; screen library; operator console separate from the editor; display assignment from a phone; revisions and one-click revert; export/import a show as one file. |
| G3 | **Easy to deploy** | Single process and port, Docker image (amd64 + arm64), compose file, zero internet dependency, QR codes to connect displays. |
| G4 | **Versatile look** | Theme packs with their own renderers, frames, decor, state effects, fonts and sounds; semantic colours; neutral base theme as fallback. |
| G5 | **Completely different UI later** (next phase, keep in mind) | Widgets are theme-agnostic; frames are mapped by archetype; decor is theme-scoped; a second theme is an explicit roadmap phase with exit criteria. |
| G6 | **One-click UI per section** | Seeded generator over recipes + archetypes + blocks; reroll, lock, regenerate, generate a suite. |
| G7 | **Partial manual + AI fill** | Locked nodes and `placeholder` widgets with an intent ("plasma flow diagnostics here"); the generator fills empty slots, AI fills intents. |
| G8 | **MCP so AI can manipulate the UI and create elements** | `/mcp` endpoint over the shared command layer; AI can create blocks (composite elements), recipes, sanitized SVG shapes and theme variants without code. |

Non-goals for v2: multi-tenant cloud hosting, user accounts beyond an optional shared editor token,
real-time collaborative editing with CRDTs (optimistic revisions are enough for 1 human + 1 AI), native
mobile apps, and arbitrary AI-written JavaScript executing on displays.

## 3. Where we are today

What works and should be kept: the monorepo and tooling (pnpm, strict TS, oxlint, knip, husky), Fastify +
Socket.io, Zod validation, React 19 + Vite, the SVG elbow path generator, the video command queue,
atomic JSON writes with path-traversal protection, the TDD habit, and the `docs/solutions` learnings.
All 68 unit tests pass on `develop` today.

What blocks the goals (verified in code on 2026-10-14):

| Finding | Evidence | Why it matters |
|---|---|---|
| Element knowledge is spread across ~8 places | `shared/src/types.ts`, `server/src/validation.ts`, `LayoutRenderer.tsx`, `Canvas.tsx`, `PropertyPanel.tsx` (455 lines of per-type branches), `BuilderPage.tsx` defaults, `Palette.tsx` + a duplicate palette list in `BuilderPage.tsx`; the checklist in `docs/solutions/architecture/007-canvas-layoutrenderer-prop-parity.md` exists because of it | Every new element or prop is a multi-file change that drifts. |
| **It already drifted: bar end caps are silently dropped on save** | `LayoutElementSchema` in `server/src/validation.ts` has no `startCap`/`endCap`; Zod 4 strips unknown keys (confirmed with zod 4.3.6) | The builder shows pointed caps, the saved layout loses them. |
| Look is hard-wired to LCARS | Hex colours stored per element (`"color": "#ff9900"`), `lcars-*` classes, `LCARS_COLORS` in `PropertyPanel.tsx`, state colours hard-coded in `OperatorPanel.tsx` | A theme switch can only recolour, and only partly. |
| Fixed pixel grid | `constants/grid.ts`: 12 columns × 60 px → the display uses 768 px of any screen (see `docs/screenshots/display-client.png`) | Screens on set have different sizes and aspects. |
| Every display shows the same layout | `server/src/index.ts`: `identify` always sends `default`; `?screen=` is only a label | No per-station screens. |
| Builder cannot open saved layouts | `BuilderPage.tsx` "never loads from \[the server\]"; new layouts are saved with id `new` | Editing the live layout is not possible. |
| Display buttons do nothing | `DisplayScreen.tsx` `handleButtonClick` is a no-op | Actors get press feedback but no behaviour. |
| Global states are a fixed enum in 5 places | types, Zod, `getStateClass.ts`, `OperatorPanel.tsx`, `theme.css` | "Yellow alert" or "intruder" needs a code change everywhere. |
| Dev-only deployment | Two processes (Vite on 5176, `tsx watch` on 3010), `VITE_SERVER_URL` baked at build, no Dockerfile | Hard to run on a set laptop. |
| Needs internet on set | `theme.css` imports Antonio from Google Fonts | Offline set → fallback font, wrong look. |
| Two diverged `default.json` copies | `data/layouts/` vs `packages/server/data/layouts/` (server reads the root one) | Confusing source of truth. |

These are not reasons to throw the code away; they are the specific things the new model removes.

## 4. The core idea: meaning vs. look

```mermaid
flowchart TB
  subgraph Content["Content (theme-agnostic, stored in screen JSON)"]
    W["Widgets: button · readout · gauge · data-cascade · clock · video …"]
    L["Layout: frame archetype + slots · stack · grid · canvas"]
    S["Behaviour: bindings to signals · actions · per-state overrides"]
  end
  subgraph Theme["Theme pack (code + tokens)"]
    T1["Tokens: palette roles, fonts, radii, spacing"]
    T2["Renderers per widget (slot-aware)"]
    T3["Frames per archetype (screen chrome with named slots)"]
    T4["Decor primitives (LCARS elbow, bar, cap…)"]
    T5["State effects: what 'alert' or 'damaged' looks and sounds like"]
  end
  subgraph Words["Content pack (data)"]
    P1["Section recipes: engineering, weapons, …"]
    P2["Vocabulary & technobabble style"]
    P3["Blocks: reusable widget compositions"]
  end
  Content --> R["Runtime renderer"]
  Theme --> R
  Words --> G["Generator / AI"] --> Content
```

- **Widgets** say *what* something is: "a list of navigation buttons", "a readout of warp core output in %",
  "a scrolling cascade of numbers". They never mention elbows or hex colours.
- **Themes** decide *how* it looks. LCARS renders a nav list in the sidebar slot as flush coloured blocks
  with right-aligned labels; a future CRT theme renders the same list as inverse-video menu lines.
- **Content packs** hold the words: what engineering is about, which buttons make sense on a weapons
  console, how numbers are formatted. They are data, so AI can write new ones.

Switching a show from LCARS to another theme therefore re-renders every widget natively, swaps the chrome
by archetype, and hides LCARS-only decoration (or maps it, if the new theme declares a mapping).

## 5. Architecture

### 5.1 Packages

```
packages/
  core/      @interactive-displays/core     pure TS (no React, no Node APIs); runs in browser and server
             schema/      Zod schemas: Show, Screen, Node, Op, Signal, Action, Recipe, Block
             catalog/     defineWidget() registry + all widget definitions
             ops/         apply / invert / validate operations, revisioning
             generator/   seeded generator, archetype fillers, tone assignment
             lint/        structural lint (counts, label length vs slot, missing bindings)
             migrate/     document migrations (v1 flat layouts → v2 trees, future versions)
             protocol/    typed Socket.io events + REST payloads
  themes/    @interactive-displays/themes
             base/        neutral theme: renders every widget; also the builder's "wireframe" mode
             lcars/       manifest.ts (pure data) + react/ (renderers, frames, decor) + fonts/ + sounds/
  server/    Fastify: REST, Socket.io, MCP, command layer, persistence, signal engine, AI fill, static app
  app/       React SPA, lazy routes: /d/:displayId · /builder · /operator · /gallery
content/     default content packs (data, versioned with code): trek/recipes, trek/vocab, blocks
```

`shared` is renamed to `core` and grows into the place where most logic lives. Each theme has two entry
points: `manifest` (pure data, readable by the server, generator and MCP) and `react` (renderers, loaded only
in the browser). Import boundaries are enforced with a lint rule: `core` imports nothing app- or
node-specific; theme manifests import only `core`; the server imports `core` + manifests.

Themes live in one package (not one package per theme) until there is a reason to publish them
separately; the folder boundary keeps that move cheap.

### 5.2 Runtime topology

```mermaid
flowchart LR
  subgraph Server["server — one Node process, one port"]
    API["REST /api"]
    WS["Socket.io"]
    MCP["MCP /mcp"]
    AIF["AI fill (optional)"]
    CMD["Command layer: validate → apply ops → persist → broadcast"]
    GEN["Generator"]
    SIG["Signal engine"]
    REPO[("data/ JSON + revisions")]
    STATIC["Static app files"]
    API --> CMD
    WS --> CMD
    MCP --> CMD
    AIF --> CMD
    CMD --> GEN
    CMD --> REPO
    SIG --> WS
  end
  D["Displays ×6–15"] <--> WS
  B["Builder"] <--> WS
  O["Operator (phone/tablet)"] <--> WS
  B --> API
  AG["Claude Desktop / Claude Code / any MCP client"] --> MCP
```

The **command layer** is the single write path. It validates input against the `core` schemas, applies
operations, bumps the revision, persists, and broadcasts. REST, Socket.io, MCP and the built-in AI are thin
adapters over it, so anything a person can do in the builder an agent can do through MCP and vice versa
(parity is tested, [§16](#16-maintainability-and-quality)).

### 5.3 Glossary

| Term | Meaning |
|---|---|
| **Show** | A production. Holds theme choice, states, signals, screens, displays, blocks, assets. One is active. |
| **Screen** | One designed UI (was "layout"). A document with a node tree, a profile and revisions. |
| **Display** | A physical browser client (TV, tablet, monitor). Gets assigned a screen by the operator. |
| **Widget** | Theme-agnostic UI element defined in `core` (button, readout, gauge…). |
| **Decor** | Theme-specific ornament with no meaning (LCARS elbow, bar, end cap). |
| **Frame / archetype** | Screen skeleton with named slots (`title`, `nav`, `main`, `status`…); each theme draws its own chrome for it. |
| **Block** | A saved, reusable composition of widgets ("warp core panel"). The no-code way to make new elements. |
| **Recipe** | Data describing a section (engineering…) for the generator: systems, metrics, actions, labels. |
| **Signal** | A named live value (`warp.output`) that widgets bind to; ambient (client-side noise) or shared (server). |
| **State** | Show-wide mode (normal, red alert, damaged…) with a visual effect defined by the theme. |

## 6. Document model

All of the following are Zod schemas in `core/schema`; TypeScript types are `z.infer` of them.

### 6.1 Show

```ts
interface Show {
  schemaVersion: 2
  id: string
  name: string
  theme: { id: string; variant?: string; tokens?: Partial<ThemeTokens> } // e.g. { id: 'lcars', variant: 'tng' }
  content: string[]                 // content packs in use, e.g. ['trek']
  states: StateDef[]                // data-driven; replaces the 4-value enum
  signals: SignalDef[]              // shared live values
  displays: DisplayDef[]            // known displays, their names and assigned screen
  settings: {
    liveEdit: boolean               // false = edits go to drafts until published (default)
    displayGlobalActions: boolean   // may a display button change show state? (per-button opt-in otherwise)
    ai: { mcp: boolean; allowPublish: boolean; allowLiveControl: boolean }
  }
}

interface StateDef {
  id: string                        // 'normal' | 'red-alert' | 'yellow-alert' | 'intruder' | …
  label: string
  effect: 'none' | 'warning' | 'alert' | 'damaged' | 'blackout'   // the theme decides what each looks like
  banner?: string                   // e.g. 'RED ALERT' for alert-banner widgets
  sound?: string                    // theme sound id, e.g. 'klaxon'
}
```

### 6.2 Screen and nodes

```ts
interface Screen {
  schemaVersion: 2
  id: string
  name: string
  section?: string                  // 'engineering'
  tags: string[]
  profile: { aspect: '16:9' | '4:3' | '21:9' | '9:16' | '16:10'; fit: 'fluid' | 'contain' }
  revision: number                  // optimistic concurrency + history
  published?: number                // revision shown on displays
  generator?: { recipe: string; archetype: string; seed: number; density: 'sparse' | 'normal' | 'dense' }
  root: Node
}

type Node = ContainerNode | WidgetNode | DecorNode

interface NodeBase {
  id: string
  locked?: boolean                  // generator and AI must not change it
  hidden?: boolean
  when?: Array<{ state: string; props?: Record<string, unknown>; hidden?: boolean }>  // per-state overrides
}

interface ContainerNode extends NodeBase {
  type: 'container'
  layout:
    | { kind: 'frame'; archetype: string }                         // theme draws chrome, children fill slots
    | { kind: 'stack'; direction: 'row' | 'column'; gap?: Space }  // flex, children have weights
    | { kind: 'grid'; columns: Track[]; rows: Track[] }            // fr tracks, children have areas
    | { kind: 'canvas' }                                           // free placement, normalised 0..1 rects
  children: Array<{ node: Node; slot?: string; weight?: number; area?: GridArea; rect?: NormRect }>
}

interface WidgetNode extends NodeBase {
  type: 'widget'
  kind: string                      // a catalog kind: 'button', 'readout', 'gauge', …
  props: Record<string, unknown>    // validated against the catalog schema for `kind`
  bind?: Record<string, Binding>    // prop → signal, e.g. { value: { signal: 'warp.output' } }
  actions?: Action[]
}

interface DecorNode extends NodeBase {
  type: 'decor'
  kind: string                      // theme-scoped: 'lcars.elbow', 'lcars.bar', or 'shape:<id>'
  props: Record<string, unknown>
}
```

Notes:

- **Colours are roles.** Widget props use `tone: 'primary' | 'secondary' | 'accent' | 'info' | 'neutral' |
  'success' | 'warning' | 'danger'` (plus a theme's extra named swatches such as LCARS `tan`, `salmon`).
  A raw hex override exists as an escape hatch but is flagged by lint.
- **Locks and placeholders** are the hand-off between people, the generator and AI. A `placeholder` widget
  carries `{ intent: 'plasma flow diagnostics', size?: 'small' | 'large' }`.
- **`canvas` keeps hand-made art possible.** Pixel-perfect LCARS compositions like the ones in `design/`
  can still be built by free placement; structured containers are for generated and adaptive screens.

### 6.3 Signals, bindings and actions

```ts
interface SignalDef {
  id: string                        // 'warp.output'
  label: string
  unit?: string                     // '%', 'K', 'GW'
  scope: 'shared' | 'ambient'       // shared = server-owned, same everywhere; ambient = computed per client
  source:
    | { kind: 'static'; value: number | string }
    | { kind: 'walk'; min: number; max: number; volatility: number }   // random walk
    | { kind: 'wave'; min: number; max: number; periodMs: number }
    | { kind: 'clock'; format: 'time' | 'stardate' | 'countdown'; target?: string }
    | { kind: 'manual' }            // only the operator / actions change it
  byState?: Record<string, Partial<SignalDef['source']>>  // e.g. red-alert: { min: 40, max: 120 }
}

type Binding = { signal: string } | { ambient: SignalDef['source'] }   // inline ambient for generated noise

type Action =
  | { do: 'navigate'; screen: string } | { do: 'back' }               // local to the display
  | { do: 'setState'; state: string }                                 // global, gated
  | { do: 'setSignal'; signal: string; value?: number; delta?: number }
  | { do: 'toggle'; target: string }                                  // local UI state (highlight, expand)
  | { do: 'video'; target: string; command: 'play' | 'pause' | 'seek' | 'load'; time?: number; src?: string }
  | { do: 'sound'; sound: string }
  | { do: 'cue'; cue: string }                                        // later: scripted scene cues
```

Every button gets a default `flash` + press sound if it has no actions, so actors always get feedback
("safe freeform" from the brainstorm).

**Ambient vs shared signals.** Most numbers on sci-fi screens are decoration; they should move but
nobody cares if two screens disagree. Ambient signals run in each client from a seed (the node id), cost no
network, and keep animating if the server disappears. Shared signals (the shield level the story depends
on) are owned by the server, ticked at ≤10 Hz in batched updates, and controllable from the operator console.

### 6.4 Example (abridged, generated engineering screen)

```json
{
  "schemaVersion": 2,
  "id": "eng-main",
  "name": "Main Engineering",
  "section": "engineering",
  "profile": { "aspect": "16:9", "fit": "fluid" },
  "revision": 7,
  "published": 7,
  "generator": { "recipe": "trek/engineering", "archetype": "sidebar", "seed": 48213, "density": "normal" },
  "root": {
    "id": "root", "type": "container", "layout": { "kind": "frame", "archetype": "sidebar" },
    "children": [
      { "slot": "title", "node": { "id": "t1", "type": "widget", "kind": "title",
        "props": { "text": "Main Engineering", "code": "ENG 04-7731" } } },
      { "slot": "nav", "node": { "id": "n1", "type": "widget", "kind": "button-group",
        "props": { "items": ["Warp Core", "EPS Grid", "Impulse", "SIF", "Damage Control"], "tone": "auto" },
        "actions": [{ "do": "navigate", "screen": "eng-warp" }] } },
      { "slot": "main", "node": { "id": "m1", "type": "container",
        "layout": { "kind": "grid", "columns": ["2fr", "1fr"], "rows": ["1fr", "1fr"] },
        "children": [
          { "area": { "col": 1, "row": 1 }, "node": { "id": "g1", "type": "widget", "kind": "gauge",
            "props": { "label": "Core Output", "unit": "%", "min": 0, "max": 120, "variant": "segmented" },
            "bind": { "value": { "ambient": { "kind": "walk", "min": 92, "max": 99, "volatility": 0.2 } } },
            "when": [{ "state": "red-alert", "props": { "tone": "danger" } }] } },
          { "area": { "col": 2, "row": 1 }, "node": { "id": "c1", "type": "widget", "kind": "data-cascade",
            "props": { "columns": 4, "speed": "normal" } } },
          { "area": { "col": 1, "row": 2, "colSpan": 2 }, "node": { "id": "p1", "type": "widget",
            "kind": "placeholder", "locked": false, "props": { "intent": "antimatter containment status" } } }
        ] } },
      { "slot": "status", "node": { "id": "s1", "type": "widget", "kind": "clock", "props": { "format": "stardate" } } },
      { "slot": "decor", "node": { "id": "d1", "type": "decor", "kind": "lcars.bar", "props": { "tone": "tan" } } }
    ]
  }
}
```

## 7. Widget catalog and registry

### 7.1 One definition, many uses

```ts
// core/catalog/readout.ts
export const readout = defineWidget({
  kind: 'readout',
  label: 'Readout',
  category: 'data',
  props: z.object({
    label: z.string().max(40).meta({ control: 'text' }),
    value: z.union([z.number(), z.string()]).optional(),
    unit: z.string().max(8).optional(),
    precision: z.number().int().min(0).max(4).default(1),
    tone: Tone.default('secondary'),
  }),
  bindable: ['value'],
  slots: ['main', 'aside', 'status'],          // where the generator/builder may put it
  size: { min: [2, 1], preferred: [3, 1] },    // layout units, used by generator and lint
})
```

From that one definition the system derives:

1. TypeScript types (`z.infer`).
2. Server and client validation, including operations from MCP and AI.
3. The builder inspector (form generated from the schema; `.meta({ control })` picks colour-role pickers,
   signal pickers, enum segmented buttons…). This replaces the 455-line hand-written `PropertyPanel`.
4. JSON Schema for MCP tools and the Claude API (`z.toJSONSchema`).
5. Defaults for new nodes and constraints for the generator.
6. Contract tests: every widget × every theme renders its defaults, every state, and a fuzzed prop set
   without throwing; every schema round-trips.

**Adding a widget = one file in `core/catalog` + its test, and optionally a renderer in a theme.** No switch
statements, no palette lists, no parity checklist.

### 7.2 v2 widget set

| Group | Widgets | Notes |
|---|---|---|
| Layout | `frame`, `stack`, `grid`, `canvas`, `panel` (titled group) | containers |
| Text | `title`, `text`, `label-code` (LCARS-style number codes) | |
| Controls | `button`, `button-group`, `toggle`, `slider`, `keypad` | 60 px minimum touch target kept from v1 |
| Data | `readout`, `gauge` (bar / arc / segmented), `bar-graph`, `sparkline`, `status-light`, `status-matrix`, `data-cascade`, `clock` (time / stardate / countdown) | the "living screen" set the v1 plan deferred |
| Media | `video` (existing queue logic moves here), `image` (schematic, later with callouts) | |
| Alerts | `alert-banner` | shows the current state's banner text |
| Meta | `placeholder` | intent for the generator or AI to fill |

v1 elements map as: `button`, `text`, `video` → widgets; `frame` → `panel`; `elbow`, `bar` → LCARS decor
(`lcars.elbow`, `lcars.bar` keep the existing SVG path and cap code).

## 8. Theme system

### 8.1 What a theme pack contains

```ts
// themes/lcars/manifest.ts  (pure data — readable by server, generator and MCP)
export const lcars = defineTheme({
  id: 'lcars',
  name: 'LCARS',
  extends: 'base',
  variants: { tng: {/* tokens */}, voyager: {/* tokens */}, 'nemesis-blue': {/* tokens */} },
  tokens: {
    palette: { primary: '#ff9900', secondary: '#ffcc99', accent: '#cc99cc', info: '#9999ff',
               danger: '#ff3333', tan: '#cc9966', salmon: '#ff9999' },
    font: { display: 'Antonio', data: 'Antonio' },
    radius: 'pill', gap: 'tight', textCase: 'upper',
  },
  toneRules: { adjacentDiffer: true, navCycle: ['secondary', 'accent', 'info', 'tan'] },
  states: {                                   // what each StateDef.effect looks like here
    warning: { tokens: { primary: '#ffcc00' } },
    alert:   { tokens: { primary: '#ff3333', secondary: '#ff6666' }, animation: 'pulse', sound: 'klaxon' },
    damaged: { filter: 'flicker', tokens: { primary: '#776655' } },
    blackout:{ hideAll: true },
  },
  archetypes: ['sidebar', 'header-main', 'dashboard', 'split', 'media', 'console'],
  slotStyles: { nav: { button: 'block' }, toolbar: { button: 'pill' } },
  decor: { elbow: ElbowSchema, bar: BarSchema, cap: CapSchema },
  generator: { numberFormat: 'NN-NNNN', maxLabelChars: 18, density: 'dense', labelCase: 'upper' },
  fonts: ['fonts/Antonio-Regular.woff2', 'fonts/Antonio-Bold.woff2'],
  sounds: { press: 'sounds/beep-1.mp3', klaxon: 'sounds/red-alert.mp3' },
})

// themes/lcars/react/index.ts  (browser only)
export const lcarsRenderers = defineRenderers('lcars', {
  frames: { sidebar: LcarsSidebarFrame, 'header-main': LcarsHeaderFrame, dashboard: LcarsDashboardFrame },
  widgets: { button: LcarsButton, 'button-group': LcarsButtonGroup, readout: LcarsReadout,
             'data-cascade': LcarsCascade, title: LcarsTitle },   // everything else falls back to base
  decor: { elbow: LcarsElbow, bar: LcarsBar, cap: LcarsCap },
})
```

### 8.2 How rendering works

- **Tokens are CSS custom properties** on the screen root, scoped by `data-theme` and `data-state`.
  A state change is one attribute change on the root; the theme's `[data-state=alert]` rules swap tokens
  and start CSS animations. No React re-render of every element (v1 recalculates a class per element).
- **Renderers are React components** receiving resolved props (bindings already applied), the
  **slot role** they sit in, the current state, and a size class from container queries. Slot awareness
  is what makes generated LCARS look authentic: a `button` in the `nav` slot renders as a flush block in
  the sidebar sweep; in a `toolbar` slot it is a pill; in the CRT theme it is a bracketed menu line.
- **Frames** are the theme's chrome for an archetype. They expose the same slot names in every theme,
  which is what lets a screen move between themes.
- **Fallback chain:** theme renderer → parent theme (`extends`) → `base`. A new theme can start with
  only tokens and frames and still render every widget.
- **Decor** nodes render only in their own theme. On theme switch they are hidden (not deleted; the builder
  shows "4 LCARS decor elements hidden"), unless the new theme declares a `decorMap`
  (`lcars.elbow → crt.corner`).

### 8.3 Ready for a completely different UI

Nothing in widgets, recipes, signals or actions refers to LCARS. A new UI family (for example a retro CRT
terminal à la *Alien*, a flat translucent HUD à la *The Expanse*, or a military tactical display) is a new
folder under `themes/` with tokens, frames, renderers, decor and sounds, plus optionally its own content
pack for vocabulary. Renderers are ordinary React components, so a theme that needs canvas or WebGL effects
(scanlines, glow, bloom) can use them internally without changing the document model.

To keep the abstraction honest from day one, the `base` theme is built in Phase 1 and the builder can
preview any screen in it ("wireframe mode"). If something only renders correctly in LCARS, that is a bug.

### 8.4 Theme variants without code

A **theme variant** is a token overlay (palette, fonts from the theme's set, radius, density). Variants can be
created in the builder or by AI through MCP and stored in the show. This covers "LCARS but blue Nemesis era"
without touching renderers.

## 9. Layout and resolution independence

- Containers are fluid: frames and grids use `fr` tracks, stacks use weights, canvas uses normalised rects.
- A root scale unit derived from the display size drives type, stroke widths, radii and gaps, so a
  screen designed at 16:9 looks proportionally the same on a 4K TV and a 1080p monitor.
- Widgets use container-query units so labels and numbers fit their box rather than the viewport.
- Each screen has a **profile** (aspect + fit). `fluid` re-flows to the real aspect; `contain` letterboxes
  for pixel-exact art. The builder previews any profile side by side (16:9 TV, 4:3 tablet, 9:16 portrait).
- **Lint** checks what can be checked without a browser in `core` (label length vs slot, widget counts,
  empty slots, missing bindings, hex overrides) and does geometric checks (touch target ≥ 60 px at the
  profile size, text overflow) in the browser runtime, live in the builder and headless for MCP previews.

## 10. One-click generation

### 10.1 Inputs

| Input | Example | Source |
|---|---|---|
| Section recipe | `trek/engineering` | content pack (data) |
| Theme manifest | LCARS archetypes, tone rules, label rules | theme |
| Profile | 16:9, touch | screen / display |
| Density | sparse · normal · dense | user |
| Seed | 48213 | random, shown and editable |
| Locked nodes / placeholders | the user's header and one gauge | existing screen |

### 10.2 Section recipe (data)

```json
{
  "id": "trek/engineering",
  "label": "Engineering",
  "archetypes": { "sidebar": 3, "dashboard": 2, "media": 1 },
  "titles": ["Main Engineering", "Warp Propulsion Status", "Power Distribution"],
  "systems": [
    { "id": "warp-core", "label": "Warp Core",
      "metrics": [
        { "id": "output", "label": "Core Output", "unit": "%", "range": [92, 99], "alertRange": [60, 120], "widgets": ["gauge", "readout"] },
        { "id": "containment", "label": "Antimatter Containment", "unit": "%", "range": [99.2, 100], "alertRange": [40, 85] }
      ],
      "actions": [{ "label": "Eject Core", "danger": true }, { "label": "Purge Plasma" }] },
    { "id": "eps", "label": "EPS Grid", "metrics": [{ "id": "load", "label": "Grid Load", "unit": "GW", "range": [3.2, 4.1] }] },
    { "id": "sif", "label": "Structural Integrity", "metrics": [{ "id": "field", "label": "SIF Strength", "unit": "%", "range": [97, 100], "alertRange": [30, 70] }] }
  ],
  "nav": ["Warp Core", "EPS Grid", "Impulse", "SIF", "Inertial Dampers", "Damage Control", "Diagnostics"],
  "blocks": { "prefer": ["gauge-panel", "readout-stack", "data-cascade", "schematic"] },
  "alert": { "banner": true, "emphasise": ["containment", "field"] }
}
```

Default content ships ≥ 8 sections: engineering, environmental (life support), tactical/weapons, helm/navigation,
science/sensors, medical, communications, security, operations. Each is a JSON file; adding "Hydroponics" or
"Cargo Bay" is a data change, which AI can write ([§11.4](#114-ai-creating-new-elements)).

### 10.3 Algorithm

```mermaid
flowchart LR
  A["Recipe + options + seed"] --> B["Pick archetype (weighted by recipe ∩ theme ∩ profile)"]
  B --> C["Keep locked nodes; plan free slot capacity"]
  C --> D["Choose 2–4 systems; pick blocks per slot by role, size, tags"]
  D --> E["Label from recipe + vocab; bind metrics to ambient signals; add per-state reactions"]
  E --> F["Assign tones by theme rules"]
  F --> G{"Schema + lint OK?"}
  G -- no --> D
  G -- yes --> H["Draft screen with generator provenance"]
```

1. Seeded PRNG; identical inputs produce an identical screen (reproducible, testable, diffable).
2. Archetype chosen from recipe weights filtered by what the theme supports and the profile
   (portrait prefers stacked archetypes).
3. Slots are filled from **blocks** (reusable compositions: `gauge-panel` = panel + gauge + 2 readouts,
   `action-panel` = danger buttons with confirm, `status-matrix`, `readout-stack`, `data-cascade`…),
   matched by slot role, size and tags.
4. Labels come from the recipe; filler codes and numbers from the content pack's vocabulary in the theme's
   number format (`ENG 04-7731`).
5. Metrics bind to ambient signals with the recipe's ranges; `alertRange` becomes a `byState` override, so
   red alert makes the right gauges swing and turn `danger` without any extra work.
6. Tones are assigned by the theme's rules (LCARS: adjacent blocks differ, nav cycles through a palette),
   which is the "colour scheme randomisation" from the original brainstorm.
7. Every output is schema-validated and linted; a failing subtree is regenerated with a sub-seed.

### 10.4 What the user can do with it

- **Generate**: section + theme + profile → three variant thumbnails → pick one → editable draft.
- **Reroll** the whole screen or one panel (new sub-seed); undo is a revision revert.
- **Lock** anything they like (padlock on the node) and **regenerate unlocked**.
- **Leave intents**: drop a `placeholder` with a sentence; the generator fills it with the best matching block,
  or AI fills it precisely ([§11](#11-ai-mcp-and-fill-with-ai)).
- **Generate a suite**: one overview screen plus one screen per system, with nav buttons already wired to
  `navigate` between them, so actors can tap through a believable station.

### 10.5 Why deterministic first, AI second

It works offline on set, is instant, free, testable with snapshots and property tests, and its output is always
valid. AI is used where it is actually better: writing new recipes and blocks (reusable, so they pay off
forever), filling specific intents, and free-form requests. Both go through the same command layer and lint.

## 11. AI: MCP and "Fill with AI"

### 11.1 MCP endpoint

The server mounts an MCP endpoint at `/mcp` using the official MCP TypeScript SDK with the Streamable HTTP
transport, so Claude Desktop, Claude Code or any MCP client connects by URL (optionally with the editor token).
Tool handlers are thin wrappers over the command layer.

| Group | Tools | Notes |
|---|---|---|
| Discover | `get_catalog(theme?)`, `get_theme(id)`, `list_screens`, `get_screen(id, format: full \| outline)`, `list_recipes`, `list_blocks`, `list_displays` | JSON Schemas included so the model writes valid props |
| Generate | `generate_screen(section, options)`, `generate_suite(section, options)`, `regenerate(screenId, scope: node ids \| unlocked, seed?)` | deterministic generator, returns outline + lint |
| Edit | `apply_ops(screenId, baseRevision, ops[])` | one atomic batch tool; errors come back with JSON paths so the model can self-correct |
| Check | `lint_screen(screenId, profile?)`, `render_preview(screenId, profile, state)` → PNG | preview uses headless Chromium (Phase 5, optional image) |
| Library | `save_block`, `save_recipe`, `save_shape` (sanitised SVG), `save_theme_variant` | the "create new elements" path |
| Live (gated) | `publish_screen`, `assign_screen(displayId, screenId)`, `set_state`, `set_signal`, `video_command` | off by default: `settings.ai.allowPublish / allowLiveControl` |

Resources: `catalog`, `themes/{id}`, `screens/{id}`, `recipes/{id}`, and a `guides/design-rules` text with
theme design rules (LCARS conventions, label lengths, touch sizes) so generated content stays on-style.
Prompts: `design-screen`, `fill-placeholders`, `new-section-recipe`.

An example session from Claude Desktop: *"Make an environmental screen for the bridge display, life support
emphasis, keep my header from eng-main."* → `get_screen(eng-main, outline)` → `generate_screen('environmental',
{ archetype: 'sidebar' })` → `apply_ops` to copy the locked header → `lint_screen` → `render_preview` → the draft
appears live in the builder for the human to publish.

### 11.2 Built-in "Fill with AI" (optional)

For people who do not run an MCP client, the builder gets a **Fill with AI** button (placeholders, empty slots,
or a free-text instruction). The server runs a Claude tool loop over a *scratch copy* of the screen with a
subset of the same tools (`get_catalog`, `get_screen`, `apply_ops`, `lint_screen`) and returns the proposed ops
as a diff the user accepts or rejects. It is enabled only when `ANTHROPIC_API_KEY` is set.

Implementation sketch (Anthropic TypeScript SDK tool runner; the tool input schemas are the same Zod schemas as
everything else). Verify exact SDK calls against current docs at implementation time:

```ts
import Anthropic from '@anthropic-ai/sdk'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'

const applyOps = betaZodTool({
  name: 'apply_ops',
  description: 'Apply a batch of screen operations to the scratch copy. Returns new revision or validation errors.',
  inputSchema: ApplyOpsInput,                      // from core/schema
  run: async (input) => JSON.stringify(await commands.applyOps(scratch, input)),
})

const final = await client.beta.messages.toolRunner({
  model: 'claude-opus-5-5',
  max_tokens: 16000,
  output_config: { effort: 'medium' },
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
  system: designRulesForTheme(theme),              // stable → cacheable
  tools: [getCatalog, getScreen, applyOps, lintScreen],
  messages: [{ role: 'user', content: instruction }],
})
```

### 11.3 Safety rails

- **Drafts and publishing.** Displays render the published revision. Builder, generator and AI edit drafts.
  Publishing a screen that is on air asks for confirmation. `liveEdit` mode exists for rehearsals.
- **Everything is validated.** Ops from AI go through the same schemas and lint as human edits; invalid ops
  are rejected with paths, never partially applied.
- **Live control is opt-in** for AI (`allowLiveControl`) and for display buttons (`displayGlobalActions`
  or a per-button flag), so neither an agent nor an actor can trigger red alert unless intended.
- **No AI-authored code on displays.** New "elements" from AI are data: blocks, recipes, theme variants and
  SVG shapes that pass an allow-list sanitiser (path/rect/circle/line/text, token colours only, no scripts,
  no external references, size cap).
- **Audit log** of who changed what (builder, operator, generator, AI via MCP) for on-set debugging.

### 11.4 AI creating new elements

Three tiers, from safest and most common to rarest:

1. **Blocks (no code).** A composite of existing widgets saved with a name and tags ("Warp core panel",
   "Torpedo loading bay"). Appears in the builder library and in generator block selection.
   Recipes and theme variants are the same kind of data.
2. **Shapes (no code).** Declarative, sanitised SVG decor with token colours, for new ornaments in the current
   theme's style.
3. **New widget kinds or themes (code).** A new renderer or widget is a repo change. The registry makes this a
   small, well-defined change, and a Claude Code skill (`add-widget`, `add-theme`) documents the exact
   files and tests, so Claude Code can open a PR for it.

## 12. Runtime: displays, sync, operator

### 12.1 Displays and assignment

- A display opens `/d/<displayId>` (or `/d/` and gets a short code shown on screen). The server remembers it.
- The operator names displays and assigns screens from the console; assignments live in `show.json` and
  survive restarts. A display follows reassignment instantly.
- **Identify**: the operator taps a display in the list, the physical screen flashes its name.
- Displays request fullscreen and a screen wake lock on first tap, hide the cursor, and reload themselves when
  the server reports a new protocol version after a deploy.

### 12.2 Real-time protocol

Socket.io stays (reconnection is already solved). Events are typed and validated in `core/protocol`.

- On connect a client sends `hello { role: 'display' | 'builder' | 'operator', displayId?, token? }` and receives a
  **snapshot** (show state, signal values, its screen, assignment). Reconnect = new snapshot, so nothing is missed.
- Rooms: `display:<id>`, `screen:<id>`, `operators`, `builders` instead of broadcasting everything to everyone.
- Shared signals are sent as batched deltas at ≤10 Hz; ambient signals never touch the network.
- Server persists runtime state (current show state, shared signal values, assignments) with debounced writes,
  so a server restart mid-shoot restores the scene.
- Budgets carried over from v1: state change visible on all displays < 100 ms, touch feedback < 50 ms,
  60 fps animations on target hardware.

### 12.3 Operator console (`/operator`)

Separated from the builder; built for a phone or tablet in a crew member's hand:

- Big state buttons generated from the show's `states`, including a **blackout** panic button.
- Display list with live mini previews, assign dropdown, identify, reload.
- Pinned shared signals as sliders ("forward shields"), video transport for video widgets.
- QR codes for display URLs, so a tablet joins by scanning.
- Later: cue list for scenes (`GO` runs a bundle of state, signal, screen and video changes).

### 12.4 Offline resilience

Self-hosted fonts and assets; a service worker caches the app shell and the last snapshot, so a display that
reloads while the server is down still shows its screen with ambient animation. This finally delivers the
offline item the original brainstorm asked for.

## 13. Builder v2

```
┌ Library ─────────┐┌ Preview (real renderer, any theme/profile/state) ┐┌ Inspector ───────────┐
│ Widgets          ││                                                   ││ generated from schema│
│ Blocks           ││     ╭───────╮━━━━━━━━━━━━━━━━  MAIN ENGINEERING   ││ tone ▸ role picker   │
│ LCARS decor      ││     │ WARP  │                                     ││ value ▸ signal picker│
│ Shapes           ││     │ EPS   │  [gauge]  [cascade]                 ││ when red-alert ▸ …   │
├ Outline ─────────┤│     │ SIF   │  [ placeholder: containment ]       ││ actions ▸ navigate … │
│ ▾ frame:sidebar  ││     ╰───────╯━━━━━━━━━━━━━━━━  STARDATE 48213.4   ││ 🔒 locked            │
│   title 🔒       ││                                                   │├ Lint ─────────────────┤
│   nav            ││  [16:9] [4:3] [9:16]   state: normal ▾  theme ▾   ││ ⚠ label too long     │
│   main ▸ grid    │└───────────────────────────────────────────────────┘└──────────────────────┘
└──────────────────┘   Generate ▾   Reroll   Regenerate unlocked   Fill with AI   Publish
```

- **One renderer.** The preview is the display runtime, so builder/display parity is structural, not a checklist.
- Drop widgets into slots or stacks (sortable), or position freely inside a `canvas` container.
- Screen library with thumbnails, tags, search, duplicate; open any saved screen (fixes v1's "cannot load").
- Every change is an op sent to the server; undo/redo is per-session op history, and **revisions** let you
  revert to any earlier version (including AI edits). AI edits made through MCP appear live.
- Asset upload (images, video, schematics) into the show's `assets/`.
- Code-split: the display bundle does not include builder code or drag-and-drop libraries.

## 14. Persistence

Still JSON files on disk (human-readable, git-friendly, no database), now organised per show and behind a small
repository interface so a different store is possible later without touching callers.

```
data/
  settings.json                 active show, optional editor token hash
  shows/<show-id>/
    show.json                   theme, states, signals, displays, settings
    runtime.json                last state, shared signal values (debounced)
    screens/<screen-id>.json
    screens/.history/<screen-id>/<revision>.json     last N revisions (default 50)
    blocks/*.json  recipes/*.json  shapes/*.json  variants/*.json
    assets/
```

- Atomic writes and id validation carry over from v1 (`docs/solutions/security/001-path-traversal-prevention.md`).
- Optimistic concurrency: ops carry `baseRevision`; a stale write gets the current revision back and the client
  rebases (builder) or retries (AI). Good enough for one person plus one agent per screen.
- **Migrations**: documents carry `schemaVersion`; `core/migrate` upgrades on read and writes back on save.
  v1 layouts migrate to a v2 screen with a `canvas` root, LCARS decor for elbows/bars, and widgets for
  button/text/video/frame, so nothing existing is lost.
- **Export/import** a whole show as one `.zip` (show + screens + library + assets) for backup and moving
  between machines.

## 15. Deployment

- **Single process.** `pnpm build` builds the app; the server serves it with `@fastify/static` alongside `/api`,
  Socket.io and `/mcp` on one port. The client connects to its own origin, which removes `VITE_SERVER_URL` and
  the CORS configuration for the normal case.
- **Docker.** Multi-stage `Dockerfile` (build with pnpm, run on `node:24-slim`, non-root user, `VOLUME /data`,
  `HEALTHCHECK` on `/health`), published to GHCR for `amd64` and `arm64` (Raspberry Pi 5, Apple silicon).
  A `-full` tag adds Chromium for `render_preview`.

  ```yaml
  # docker-compose.yml
  services:
    displays:
      image: ghcr.io/ra100/interactive-displays:latest
      ports: ["3010:3010"]
      volumes: ["./data:/data"]
      environment:
        EDITOR_TOKEN: ${EDITOR_TOKEN:-}          # optional: protects builder, operator writes and MCP
        ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-} # optional: enables "Fill with AI"
      restart: unless-stopped
  ```

- **Without Docker:** `pnpm install && pnpm build && pnpm start`.
- **Configuration** via environment only, validated with Zod at start-up: `PORT`, `DATA_DIR`, `EDITOR_TOKEN`,
  `ANTHROPIC_API_KEY`, `MCP_ENABLED`, `LOG_LEVEL`, `PUBLIC_URL`.
- **CI** (GitHub Actions): lint, typecheck, knip, unit + integration, Playwright e2e and visual snapshots on
  every PR; image build and push on tags.
- **Display setup docs:** Chromium kiosk command lines for Linux/Pi, tablet "add to home screen" (PWA), and
  the QR flow. mDNS (`interactive-displays.local`) is a later nice-to-have.

## 16. Maintainability and quality

- **Boundaries:** `core` (pure) ← `themes` manifests ← `server`; `themes/react` ← `app`. Enforced by lint rules.
- **Single schema source** (Zod 4 with `.meta()`), generated JSON Schemas for MCP and the API docs.
- **Testing pyramid:**
  - `core` unit tests: schemas, ops (apply/invert), migrations against v1 fixtures, lint.
  - Generator: snapshot tests per recipe with fixed seeds, and property tests over random seeds (every output
    validates, passes lint, has unique nav labels, respects slot capacities).
  - Contract matrix: every widget × every theme × every state effect renders without error (auto-generated
    from the registry, so new widgets are tested by default).
  - Command-layer parity: the same scenario run through REST, Socket.io and an in-process MCP client produces
    the same documents.
  - Playwright: e2e flows (generate → edit → publish → display updates; operator assigns; reconnect snapshot)
    and visual snapshots of the `/gallery` route per theme.
- **`/gallery` route** renders every widget, block and archetype in every theme and state. It is the design
  review page, the visual-regression fixture, and what `render_preview` uses.
- **Docs and agent guidance:** update `AGENTS.md` conventions (the "5 LCARS elements only" rule becomes
  "widgets via the registry, look via themes"), refresh `.claude/skills/*` for the new structure, and add
  `add-widget`, `add-theme` and `write-recipe` skills. Architecture decisions continue to land in
  `docs/solutions/architecture/`.
- **Observability:** structured logs (pino, already in Fastify), `/health` with connected displays and versions,
  the audit log from [§11.3](#113-safety-rails).

## 17. Migration from the current code

| Area | Keep | Change | Remove |
|---|---|---|---|
| Tooling | pnpm, TS strict, oxlint, knip, husky, Vitest, Playwright | add import-boundary lint rule, CI workflow | |
| Server | Fastify, Socket.io, Zod, atomic writes, id validation | command layer, rooms, snapshots, static serving, `/mcp`, shows | single global broadcast, cached `default` only |
| Types | discriminated unions idea from the v1 plan | `shared` → `core`, flat `LayoutElement` → node tree | hand-written duplicate Zod schema |
| Elements | elbow SVG path code, bar cap code, video command queue | elbow/bar → LCARS decor; button/text/video → widgets; frame → panel | per-type switches in `Canvas` and `LayoutRenderer` |
| Look | Antonio, LCARS palette | tokens per theme, colour roles, self-hosted fonts | hex per element, `LCARS_COLORS`, Google Fonts import |
| Layout | 12-column idea as one possible grid | fluid containers + profiles | fixed 60 px cells |
| Builder | dnd-kit, `useReducer` undo pattern | outline + slots + schema inspector + generator + revisions | hand-written `PropertyPanel`, duplicate palette lists |
| Operator | big state buttons | own route, data-driven states, display assignment | operator inside the builder sidebar |
| Data | JSON files | per-show folders, revisions, migrations | duplicate `packages/server/data/layouts/default.json` |

The v1 routes keep working until the v2 builder reaches parity (end of Phase 2); the v1 layout files are migrated
on first read.

## 18. Roadmap

Each phase ends with something usable and a short manual testing guide, per `AGENTS.md`.

| Phase | Goal | Scope | Exit criteria |
|---|---|---|---|
| **0. Deploy what exists** (small) | Easy to run anywhere, offline | Server serves the built app on one port; same-origin client; Dockerfile + compose; CI workflow; self-host Antonio; fix the bar-cap schema drift; remove the duplicate `default.json` | `docker run` gives the current system on one port with no internet access; CI green on PRs |
| **1. Core model + LCARS port** | The foundation everything else needs | `core` package (schemas, `defineWidget`, ops + revisions, migrations, structural lint, protocol); `base` + `lcars` themes; fluid containers and 3 archetypes (sidebar, header-main, dashboard); single renderer; display identity + assignment; snapshot on connect; persisted runtime state; `/gallery` + contract tests | The current default layout migrates and renders; the same screen renders in `base`; adding a widget touches one core file (+ optional renderer); displays can show different screens |
| **2. Builder v2 + operator console** | Easy to manage | Outline/slots/canvas editing, schema-driven inspector, profiles preview, locks, revisions and revert, drafts and publish, screen library, assets; `/operator` with data-driven states, display list, assign, identify, video, blackout, QR codes | Crew assigns screens and triggers states from a phone; any saved screen can be opened, edited and published |
| **3. Living screens** | Screens that look alive and react | Data widgets (readout, gauge, bar-graph, sparkline, status-light/matrix, data-cascade, clock, alert-banner, button-group, toggle, image); signals (ambient + shared), bindings, per-state overrides; display actions (navigate, back, setState, setSignal, video, sound) | A hand-built engineering screen animates believably, red alert visibly changes it, display buttons do something |
| **4. One-click generation** | Generate a sensible screen per section | Content pack format; default `trek` pack with ≥8 section recipes and a block library; seeded generator; reroll, lock, regenerate unlocked; placeholders; generate suite with wired nav; Generate dialog with variants; property/snapshot tests | Choosing "Weapons" yields a plausible, on-style, touch-safe screen in one click; reroll differs; locked parts survive |
| **5. AI and MCP** | AI can read, generate, edit and extend | Command-layer parity tests; `/mcp` tools, resources and prompts; token auth and gating; Fill with AI (optional); AI-authored blocks, recipes, shapes and variants; `render_preview` in the `-full` image | From Claude Desktop/Code: "environmental screen, keep my header" produces a lint-clean draft that appears live in the builder |
| **6. New UI family + show tooling** | Completely different UI | Second theme pack (direction to be chosen) with frames, renderers, decor, sounds and its own content pack; decor mapping on theme switch; cue lists; sound packs; PWA/kiosk polish | An existing show re-skinned to the new theme looks native, and generated screens in that theme look designed for it |

Dependencies: 0 → 1 → 2 and 3 (can overlap) → 4 → 5 → 6. A thin MCP slice (read tools + `apply_ops` +
`generate_screen`) only needs Phase 1's command layer and Phase 4's generator, so it can be pulled forward if
AI-assisted authoring of recipes is wanted earlier.

## 19. Decisions needed

My recommendation is listed first; work can start on Phase 0 and 1 with these defaults.

1. **Multiple shows?** Recommended: yes, show folders with one active (answers the brainstorm's
   multi-production question). Alternative: one implicit show, simpler but harder to reuse between productions.
2. **Display hardware to optimise for?** Recommended default: Chromium on mixed TVs and tablets, profiles 16:9 and
   4:3, performance tested on a Raspberry Pi 5 as the weakest target. Tell me if the set uses something weaker.
3. **Can actors' taps change show-wide state?** Recommended: only buttons explicitly marked for it.
4. **Second UI family for Phase 6?** No decision needed now; candidates are retro CRT terminal, flat translucent
   HUD, or military tactical. The architecture does not depend on the choice.
5. **Built-in AI needs an Anthropic API key on the server; MCP does not.** Recommended: build MCP first, keep the
   built-in button optional.

## 20. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Abstraction makes LCARS look generic | Slot-aware renderers, LCARS-specific frames and decor, golden screenshots reviewed against `design/` references, free-form `canvas` for hand-made art |
| Tree editing makes the builder harder to use than the grid | Outline + slots for structure, `canvas` for free placement, generator does the heavy lifting; usability check with a non-technical person at the end of Phase 2 |
| Generated screens feel samey | Content-heavy recipes and blocks, theme tone rules, multiple archetypes, AI-written recipes to grow variety |
| AI or an editor changes a display during a take | Drafts + publish, gated live control, audit log |
| Weak display hardware with many animated widgets | CSS-only animations, state via one root attribute, throttled number updates, per-node memoised renderers, display bundle excludes builder code |
| Migration loses existing work | v1 fixtures in migration tests, migrate-on-read keeps the original file until first save, show export before upgrade |
| Scope creep | Phases ship independently; Phase 6 is explicitly later |

## 21. Appendix

### 21.1 Archetype slot contracts (theme-agnostic)

| Archetype | Slots | Typical use |
|---|---|---|
| `sidebar` | `title`, `nav`, `main`, `status`, `decor` | classic LCARS console |
| `header-main` | `title`, `toolbar`, `main`, `status` | wide displays, operator-like screens |
| `dashboard` | `title`, `nav`, `main` (grid of panels), `status` | environmental, engineering overview |
| `split` | `title`, `left`, `right`, `nav` | comparison, sensors |
| `media` | `title`, `main` (video/schematic), `aside` (readouts), `nav` | schematics, viewscreen side panels |
| `console` | `title`, `keypad`, `readouts`, `status` | transporter, weapons fire control |

### 21.2 Operations

```ts
type Op =
  | { op: 'add'; parent: string; slot?: string; index?: number; node: Node }
  | { op: 'update'; id: string; props?: Record<string, unknown>; bind?: Record<string, Binding | null>;
      actions?: Action[]; locked?: boolean; when?: NodeBase['when'] }
  | { op: 'move'; id: string; parent: string; slot?: string; index?: number }
  | { op: 'remove'; id: string }
  | { op: 'replace'; id: string; node: Node }
  | { op: 'screen'; name?: string; profile?: Screen['profile']; tags?: string[] }
```

Each op has an inverse computed at apply time, which powers undo and revision diffs.

### 21.3 Prior art worth borrowing from

Catalog-constrained generative UI is an established pattern: an agent emits declarative JSON limited to a
trusted component catalog and the client renders it with its own components. Google's
[A2UI](https://github.com/google/A2UI) and Vercel's [json-render](https://www.infoq.com/news/2026/03/vercel-json-render)
both work this way. This design applies the same idea, with themes as the renderer side and the deterministic
generator as a non-AI producer of the same JSON.

### 21.4 Brainstorm open questions, answered

| Question (2026-02-04 brainstorm) | Answer in v2 |
|---|---|
| Asset management | Per-show `assets/` with upload in the builder, referenced by id |
| Multi-production | Shows ([§19](#19-decisions-needed) item 1) |
| Audio | Theme sound packs, per-state sounds, button press sounds (Phase 3 basics, Phase 6 packs) |
