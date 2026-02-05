---
title: "feat: LCARS Interactive Display System"
type: feat
date: 2026-02-04
deepened: 2026-02-04
reviewed: 2026-02-04
---

# LCARS Interactive Display System

## Post-Review Simplification Summary

**Reviewed by:** DHH-style reviewer, Kieran TypeScript reviewer, Simplicity reviewer
**Consensus:** Simplify aggressively for MVP

### Applied Simplifications

1. **2 packages** (down from 4) - `server` and `app` only
2. **5 elements** (down from 7) - elbow, bar, frame, button, text
3. **3 phases** (down from 4) - Foundation, Elements, Builder+Operator
4. **React Context** (not Zustand) - simpler for 15 clients
5. **10-level undo** (down from 50) - simple array, no Zundo
6. **Deferred to v2:** Security infrastructure, agent-native API, Service Worker

### Guiding Principle

> "The simplest system that works: One server broadcasting state to all clients. One React app that can be display mode or builder mode. Five components that change color based on global state. One JSON file per layout."

---

## Overview

A WebSocket-based client-server system for creating and displaying interactive LCARS-style sci-fi interfaces for video production. The system enables 6-15 simultaneous browser displays with real-time coordination via triggered events (red alert, damage states), operated by non-technical crew with simple trigger buttons, while actors interact directly with touchscreen displays.

## Problem Statement / Motivation

Video productions requiring sci-fi interface displays currently lack a purpose-built solution that combines:
- Real-time synchronization across multiple screens
- Simple operation for non-technical crew
- Reliable actor interaction with visual feedback
- Offline resilience for on-set reliability
- Visual design tools for rapid iteration

Existing solutions require either expensive proprietary software, complex video playback coordination, or static pre-rendered content that can't respond to live interaction.

## Proposed Solution

A two-part system (simplified from original three-part):

1. **Server** - Fastify + Socket.io, broadcasts state, serves layouts from JSON files
2. **App** - Single React app with two modes: display (for screens) and builder (for editing)

No separate "shared" package - types live in server, imported by app.

## Technical Approach

### Architecture (Simplified)

```
┌───────────────────────────────────────────────────────┐
│                      SERVER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Layouts     │  │ globalState │  │ Socket.io    │  │
│  │ /data/*.json│  │ (string)    │  │ (broadcast)  │  │
│  └─────────────┘  └─────────────┘  └──────────────┘  │
│  Node.js 24 LTS / Fastify / TypeScript               │
└───────────────────────────────────────────────────────┘
                         │
         Socket.io (single namespace)
                         │
    ┌────────────────────┴────────────────────┐
    ▼                                          ▼
┌─────────────────────┐          ┌─────────────────────┐
│   APP (Display)     │          │   APP (Builder)     │
│   /?screen=bridge   │          │   /builder          │
│                     │          │                     │
│  Shows layout       │          │  Drag-drop editor   │
│  Responds to state  │          │  Operator buttons   │
└─────────────────────┘          └─────────────────────┘
      × 6-15 screens                   × 1 editor
```

### Socket.io Configuration

Single namespace, no rooms complexity for MVP:

```typescript
// Server - broadcast state to all clients
io.emit('state', globalState);

// Client - reconnection handled by Socket.io defaults
const socket = io(SERVER_URL);
```

### Project Structure (Simplified)

```
lcars/
├── packages/
│   ├── server/              # Fastify + Socket.io
│   │   ├── src/
│   │   │   ├── index.ts     # Entry point
│   │   │   ├── socket.ts    # Socket.io handlers
│   │   │   ├── layouts.ts   # JSON file CRUD
│   │   │   └── types.ts     # Shared types (imported by app)
│   │   └── package.json
│   │
│   └── app/                 # React app (display + builder)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx      # Routes to Display or Builder
│       │   ├── context/
│       │   │   └── DisplayContext.tsx  # React Context for state
│       │   ├── components/
│       │   │   ├── Elbow.tsx
│       │   │   ├── Bar.tsx
│       │   │   ├── Frame.tsx
│       │   │   ├── Button.tsx
│       │   │   └── Text.tsx
│       │   ├── display/
│       │   │   └── DisplayScreen.tsx
│       │   └── builder/
│       │       ├── BuilderPage.tsx
│       │       ├── Canvas.tsx
│       │       ├── Palette.tsx
│       │       └── OperatorPanel.tsx
│       └── package.json
│
├── data/
│   └── layouts/             # JSON files (gitignored)
│
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

### Dependencies (Minimal)

```json
{
  "server": {
    "dependencies": {
      "fastify": "^4.x",
      "socket.io": "^4.x"
    }
  },
  "app": {
    "dependencies": {
      "react": "^19",
      "react-dom": "^19",
      "react-router-dom": "^6",
      "socket.io-client": "^4.x",
      "@dnd-kit/core": "^6"
    }
  }
}
```

**Removed from MVP:** Zustand, Zundo, Zod, DOMPurify, rate-limiter-flexible

### Implementation Phases (3 Phases)

> **Reviewer consensus:** Original 7 phases → 4 phases → now 3 phases.
> Build the simplest thing that works. Iterate based on real usage.

#### Phase 1: Foundation (Server + Display)

**Goal:** Server broadcasts state, display client renders layouts

**Tasks:**

- [ ] **1.1 Project Setup**
  - Initialize pnpm monorepo: `packages/server`, `packages/app`
  - TypeScript config (strict mode)
  - **Oxc** for linting and formatting (replaces ESLint + Prettier)
  - **Knip** for detecting unused exports, dependencies, files
  - **Husky + lint-staged** for pre-commit hooks (lint + typecheck)

  Files: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `oxlint.json`, `knip.json`, `.husky/pre-commit`

  **Setup commands:**
  ```bash
  pnpm add -D -w oxlint knip husky lint-staged
  pnpm exec husky init
  ```

  **knip.json:**
  ```json
  {
    "$schema": "https://unpkg.com/knip@latest/schema.json",
    "workspaces": {
      "packages/server": { "entry": ["src/index.ts"] },
      "packages/app": { "entry": ["src/main.tsx"] }
    }
  }
  ```

  **package.json scripts:**
  ```json
  {
    "scripts": {
      "lint": "oxlint",
      "format": "oxlint --fix",
      "typecheck": "pnpm -r run typecheck",
      "knip": "knip"
    },
    "lint-staged": {
      "*.{ts,tsx}": ["oxlint --fix", "pnpm typecheck"]
    }
  }
  ```

  **.husky/pre-commit:**
  ```bash
  pnpm lint-staged
  ```

- [ ] **1.2 Server**
  - Fastify + Socket.io
  - `globalState` variable (string: 'normal' | 'redAlert' | 'active' | 'damaged')
  - Broadcast state on change
  - Serve layout JSON via HTTP GET `/api/layouts/:id`

  Files: `packages/server/src/index.ts`, `packages/server/src/types.ts`

- [ ] **1.3 Display Client**
  - Vite + React app
  - React Context for globalState + layout
  - Connect to Socket.io, listen for state changes
  - Render layout from JSON (placeholder boxes)
  - Screen ID from URL: `/?screen=bridge`

  Files: `packages/app/src/App.tsx`, `packages/app/src/context/DisplayContext.tsx`, `packages/app/src/display/DisplayScreen.tsx`

**Success Criteria:**
- Server runs, accepts connections
- Client displays placeholder layout
- State change broadcasts to all clients
- Auto-reconnect works

---

#### Phase 2: Display Elements (5 Components)

**Goal:** 5 display components that respond to global state

**Tasks:**

- [ ] **2.1 Theme Styling**
  - CSS custom properties for colors
  - Theme font (Antonio for LCARS theme)
  - State-based color classes

  Files: `packages/app/src/theme.css`

- [ ] **2.2 Components** (5 total)
  - **Elbow** - Curved corner (TL, TR, BL, BR)
  - **Bar** - Horizontal/vertical rounded bar
  - **Frame** - Rectangular border
  - **Button** - Touchable with 60px target, press feedback
  - **Text** - Static text display

  Files: `packages/app/src/components/Elbow.tsx`, `Bar.tsx`, `Frame.tsx`, `Button.tsx`, `Text.tsx`

- [ ] **2.3 Layout Renderer**
  - Render layout JSON to component tree
  - Grid positioning (12 columns)

  Files: `packages/app/src/display/LayoutRenderer.tsx`

**Success Criteria:**
- 5 elements render with theme styling
- Elements change color on state change
- Touch feedback on Button (< 50ms)

**Theme CSS:**
```css
:root {
  /* Theme: LCARS (default) */
  --theme-primary: #ff9900;
  --theme-secondary: #ffcc99;
  --theme-accent: #cc99cc;
  --theme-info: #9999ff;
  --state-alert: #ff0000;
  --theme-radius: 30px;
}

.element {
  transition: background-color 0.3s ease-out;
}

.state--alert {
  animation: pulse 0.5s ease-in-out infinite alternate;
}

@keyframes pulse {
  to { opacity: 0.6; }
}
```

---

#### Phase 3: Builder + Operator

**Goal:** Drag-drop layout editor + operator state buttons

**Tasks:**

- [ ] **3.1 Builder Route**
  - `/builder` route in app
  - Canvas, palette, property panel layout

  Files: `packages/app/src/builder/BuilderPage.tsx`

- [ ] **3.2 Drag-Drop with @dnd-kit**
  - Palette of 5 elements
  - Drop to canvas, snap to 12-column grid
  - Click to select, drag to move

  Files: `packages/app/src/builder/Canvas.tsx`, `packages/app/src/builder/Palette.tsx`

- [ ] **3.3 Property Panel**
  - Edit selected element (color, size, label)
  - Simple form inputs

  Files: `packages/app/src/builder/PropertyPanel.tsx`

- [ ] **3.4 Save/Load**
  - Save layout to server (POST /api/layouts)
  - Load layout list
  - Simple undo (10-level array)

- [ ] **3.5 Operator Panel** (sidebar in builder)
  - 4 large buttons: NORMAL, RED ALERT, ACTIVE, DAMAGED
  - Current state indicator
  - List of connected screens

  Files: `packages/app/src/builder/OperatorPanel.tsx`

**Success Criteria:**
- Can drag elements to canvas
- Elements snap to grid
- Save/load layouts
- Operator buttons change state on all clients
- Undo works (10 levels)

**Simple Undo (no Zundo):**
```typescript
const [history, setHistory] = useState<Layout[]>([]);
const [historyIndex, setHistoryIndex] = useState(-1);

function pushHistory(layout: Layout) {
  setHistory(h => [...h.slice(0, historyIndex + 1), layout].slice(-10));
  setHistoryIndex(i => Math.min(i + 1, 9));
}

function undo() {
  if (historyIndex > 0) {
    setHistoryIndex(i => i - 1);
    setLayout(history[historyIndex - 1]);
  }
}
```

---

## v2 Roadmap (Deferred)

Add based on real usage feedback:

### Additional Elements
- Number display (animated counting)
- Status indicator (blinking lights)
- Bar graph (animated values)
- Slider, Toggle (interactive controls)
- Data grid (scrolling rows)
- **Video** - Remote-controlled playback with server commands (play/pause/seek/load), preload support, optional multi-client sync

### Features
- Service Worker offline caching
- Scripted sequences (timeline animations)
- Audio support (alert sounds)
- Zustand (if React Context becomes a bottleneck)
- Security hardening (Zod, DOMPurify, rate limiting)
- Agent-native API (REST endpoints, MCP tools)
- Docker deployment

### Quality
- Error boundaries
- Performance profiling
- Comprehensive documentation

---

## Alternative Approaches Considered

### 1. Peer-to-Peer Architecture
- **Rejected because:** State synchronization is harder, no central admin view, event delivery less reliable
- **When it would fit:** Simpler setups with fewer coordination needs

### 2. Static HTML Export
- **Rejected because:** Changes require regenerating exports, less flexible during shoots
- **When it would fit:** Locked-down productions where screens don't change day-of

### 3. Canvas/WebGL Rendering
- **Rejected because:** No native touch events (must implement hit testing), accessibility gone, much more complex
- **When it would fit:** Background displays with heavy animation, no interactivity needed

### 4. Separate React Codebases for Builder/Client
- **Rejected because:** Two implementations to maintain, preview might not match client
- **When it would fit:** Many clients on older hardware where bundle size is critical

---

## Acceptance Criteria (MVP)

### Must Have
- [ ] Server accepts 15+ WebSocket connections
- [ ] State changes propagate within 100ms
- [ ] 5 display elements render correctly
- [ ] Builder creates layouts via drag-drop
- [ ] Operator panel triggers state changes
- [ ] Layouts persist as JSON files

### Should Have
- [ ] Touch feedback < 50ms
- [ ] 60fps animations
- [ ] Auto-reconnect on disconnect
- [ ] 10-level undo in builder

### Quality
- [ ] TypeScript strict mode
- [ ] Works in Chrome, Firefox, Safari
- [ ] No console errors in normal operation

---

## Success Metrics

1. **Reliability:** Zero unplanned display outages during takes
2. **Responsiveness:** All state changes visible within 100ms
3. **Usability:** Non-technical crew can operate within 5 minutes of training
4. **Flexibility:** New screen layout can be created in under 30 minutes

---

## Dependencies & Prerequisites

### Required
- Node.js 24 LTS
- pnpm 9+

### MVP Dependencies
- Socket.io 4.x - WebSocket communication
- Fastify 4.x - HTTP server
- React 19 - UI framework
- Vite 6.x - Build tool
- @dnd-kit/core - Drag-drop
- react-router-dom - Routing

### Dev Dependencies
- oxlint - Fast linting and formatting (Rust-based, replaces ESLint + Prettier)
- knip - Unused code/dependency detection
- husky - Git hooks
- lint-staged - Pre-commit lint runner

### No External Services
- No database (JSON files)
- No cloud services (local server)
- No authentication (trusted LAN)

---

## Risks

| Risk | Mitigation |
|------|------------|
| WebSocket disconnects | Socket.io auto-reconnect |
| Builder complexity | Start with 5 elements, iterate |
| JSON file corruption | Atomic writes (write temp, rename) |

---

## References

- Brainstorm: `docs/brainstorms/2026-02-04-lcars-system-brainstorm.md`
- Socket.io: https://socket.io/docs/v4/
- @dnd-kit: https://dndkit.com/
- LCARS design: https://www.lcars.org.uk/

---

## Data Model (Simplified)

### Layout JSON

```typescript
// packages/server/src/types.ts

interface Layout {
  id: string;
  name: string;
  elements: LayoutElement[];
}

interface LayoutElement {
  id: string;
  type: 'elbow' | 'bar' | 'frame' | 'button' | 'text';
  col: number;      // 0-11 grid column
  row: number;      // grid row
  colSpan: number;  // width in columns
  rowSpan: number;  // height in rows
  color: string;
  // Type-specific props
  direction?: 'TL' | 'TR' | 'BL' | 'BR';  // elbow
  orientation?: 'horizontal' | 'vertical'; // bar
  label?: string;   // button, text
}

type GlobalState = 'normal' | 'redAlert' | 'active' | 'damaged';

// v2: Video element
interface VideoElement extends Omit<LayoutElement, 'type'> {
  type: 'video';
  src: string;           // URL or /assets/video.mp4
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  fit?: 'contain' | 'cover' | 'fill';
}
```

### Socket Events

```typescript
// Server → Client
socket.emit('state', globalState);           // state changed
socket.emit('layout', layout);               // send layout

// Client → Server
socket.emit('identify', screenId);           // register screen
socket.emit('stateChange', newState);        // operator changes state
socket.emit('saveLayout', layout);           // builder saves

// v2: Video control
// Server → Client
socket.emit('videoCommand', { elementId, command: 'play' | 'pause' | 'seek' | 'load', time?, src? });
// Client → Server
socket.emit('videoState', { elementId, state: 'playing' | 'paused' | 'ended', currentTime });
```

---

## Next Steps

1. Run `/workflows:work` to begin Phase 1
2. Create `CLAUDE.md` with project conventions
3. Initialize 2-package monorepo
4. Build server + display client
5. Test with real screens
