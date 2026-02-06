---
title: "feat: LCARS Interactive Display System"
type: feat
date: 2026-02-04
deepened: 2026-02-05
reviewed: 2026-02-04
---

# LCARS Interactive Display System

## Enhancement Summary (Phase 4)

**Deepened on:** 2026-02-05
**Research agents used:** 13 parallel agents (SVG geometry, CSS patterns, React 19, TypeScript architecture, performance, simplicity, race conditions)

### Key Improvements from Research

1. **SVG Path Generation** - Use dynamic SVG paths for asymmetric elbows instead of CSS (enables true L-shaped geometry)
2. **CSS Transform Animations** - GPU-accelerated animations for number displays and status indicators
3. **Command Queuing** - Video element uses queue pattern to prevent race conditions
4. **Discriminated Unions** - TypeScript element types use discriminated unions for type safety
5. **Memoization Strategy** - Apply project learnings on React Context memoization

### Implementation Priorities (Recommended by Simplicity Review)

**Phase 4 Lite** - Ship Video element first (highest value), defer other enhancements:
1. Video element with WebSocket control (new capability)
2. Asymmetric elbows (most requested styling)
3. Button corner styles (quick win, CSS-only)
4. Defer: Number, StatusIndicator, BarGraph (add when actually needed)

---

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

- [x] **1.1 Project Setup**
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

- [x] **1.2 Server**
  - Fastify + Socket.io
  - `globalState` variable (string: 'normal' | 'redAlert' | 'active' | 'damaged')
  - Broadcast state on change
  - Serve layout JSON via HTTP GET `/api/layouts/:id`

  Files: `packages/server/src/index.ts`, `packages/server/src/types.ts`

- [x] **1.3 Display Client**
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

- [x] **2.1 Theme Styling**
  - CSS custom properties for colors
  - Theme font (Antonio for LCARS theme)
  - State-based color classes

  Files: `packages/app/src/theme.css`

- [x] **2.2 Components** (5 total)
  - **Elbow** - Curved corner (TL, TR, BL, BR)
  - **Bar** - Horizontal/vertical rounded bar
  - **Frame** - Rectangular border
  - **Button** - Touchable with 60px target, press feedback
  - **Text** - Static text display

  Files: `packages/app/src/components/Elbow.tsx`, `Bar.tsx`, `Frame.tsx`, `Button.tsx`, `Text.tsx`

- [x] **2.3 Layout Renderer**
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

- [x] **3.1 Builder Route**
  - `/builder` route in app
  - Canvas, palette, property panel layout

  Files: `packages/app/src/builder/BuilderPage.tsx`

- [x] **3.2 Drag-Drop with @dnd-kit**
  - Palette of 5 elements
  - Drop to canvas, snap to 12-column grid
  - Click to select, drag to move

  Files: `packages/app/src/builder/Canvas.tsx`, `packages/app/src/builder/Palette.tsx`

- [x] **3.3 Property Panel**
  - Edit selected element (color, size, label)
  - Simple form inputs

  Files: `packages/app/src/builder/PropertyPanel.tsx`

- [x] **3.4 Save/Load**
  - Save layout to server (POST /api/layouts)
  - Load layout list
  - Simple undo (10-level array)

- [x] **3.5 Operator Panel** (sidebar in builder)
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

---

#### Phase 4: Enhanced Elements & Styling

**Goal:** More LCARS-authentic elements with configurable internal styling

**Tasks:**

- [x] **4.1 Asymmetric Elbows** ✓ (2026-02-05)
  - Separate `verticalWidth` and `horizontalWidth` properties
  - Support for vertical arm wider than horizontal (authentic LCARS style)
  - Update property panel with width controls for each arm

  ```typescript
  interface ElbowElement {
    direction: 'TL' | 'TR' | 'BL' | 'BR';
    verticalWidth: number;   // width of vertical arm in grid units (default: 1)
    horizontalWidth: number; // width of horizontal arm in grid units (default: 1)
  }
  ```

  **Research Insights - SVG Path Approach (Recommended):**

  Use dynamic SVG paths instead of CSS border-radius for true asymmetric L-shapes:

  ```typescript
  // packages/app/src/components/Elbow.tsx
  interface ElbowProps {
    direction: 'TL' | 'TR' | 'BL' | 'BR';
    verticalWidth: number;    // pixels
    horizontalWidth: number;  // pixels
    width: number;            // total bounding box width
    height: number;           // total bounding box height
    cornerRadius: number;     // inner curve radius
    color: string;
  }

  function generateElbowPath(props: ElbowProps): string {
    const { direction, verticalWidth, horizontalWidth, width, height, cornerRadius } = props;
    const r = Math.min(cornerRadius, verticalWidth, horizontalWidth);

    // Top-Left elbow: vertical arm on left, horizontal arm on top
    if (direction === 'TL') {
      return `
        M 0 0
        L ${verticalWidth} 0
        L ${verticalWidth} ${height - horizontalWidth - r}
        Q ${verticalWidth} ${height - horizontalWidth} ${verticalWidth + r} ${height - horizontalWidth}
        L ${width} ${height - horizontalWidth}
        L ${width} ${height}
        L 0 ${height}
        Z
      `;
    }
    // Similar for TR, BL, BR...
  }

  export function Elbow({ direction, verticalWidth, horizontalWidth, ...props }: ElbowProps) {
    const path = useMemo(
      () => generateElbowPath({ direction, verticalWidth, horizontalWidth, ...props }),
      [direction, verticalWidth, horizontalWidth, props.width, props.height, props.cornerRadius]
    );

    return (
      <svg viewBox={`0 0 ${props.width} ${props.height}`} className="lcars-elbow">
        <path d={path} fill={props.color} />
      </svg>
    );
  }
  ```

  **Performance Note:** Memoize path generation - SVG path strings are expensive to compute but the result is just a string that React diffing handles efficiently.

  **Edge Cases:**
  - `cornerRadius` > min(`verticalWidth`, `horizontalWidth`) → clamp to smaller dimension
  - Zero-width arms → render as simple rectangle
  - Very small corner radius (<5px) → may appear jagged, consider minimum of 5px

---

- [x] **4.2 Button Corner Styles** ✓ (2026-02-05)
  - Per-corner radius control: `cornerStyle: 'round' | 'square'`
  - Support for pill-shaped buttons (one rounded, one flat end)
  - Left/right corner independent styling

  ```typescript
  interface ButtonElement {
    label: string;
    leftCorner: 'round' | 'square';   // default: 'round'
    rightCorner: 'round' | 'square';  // default: 'round'
  }
  ```

  **Research Insights - CSS Per-Corner Border-Radius:**

  ```typescript
  // packages/app/src/components/Button.tsx
  function getCornerRadius(corner: 'round' | 'square', height: number): string {
    return corner === 'round' ? `${height / 2}px` : '0';
  }

  export function Button({ label, leftCorner = 'round', rightCorner = 'round', height }: ButtonProps) {
    const borderRadius = useMemo(() => {
      const left = getCornerRadius(leftCorner, height);
      const right = getCornerRadius(rightCorner, height);
      return `${left} ${right} ${right} ${left}`; // TL TR BR BL
    }, [leftCorner, rightCorner, height]);

    return (
      <button
        className="lcars-button"
        style={{ borderRadius }}
      >
        {label}
      </button>
    );
  }
  ```

  **CSS Alternative (simpler for static buttons):**
  ```css
  .lcars-button--pill-left {
    border-radius: 50% 0 0 50%;  /* Round left, square right */
  }
  .lcars-button--pill-right {
    border-radius: 0 50% 50% 0;  /* Square left, round right */
  }
  ```

---

- [x] **4.3 Bar End Caps** ✓ (2026-02-06)
  - Configure each end of bar elements independently
  - Round, square, or pointed caps

  ```typescript
  interface BarElement {
    orientation: 'horizontal' | 'vertical';
    startCap: 'round' | 'square' | 'pointed';
    endCap: 'round' | 'square' | 'pointed';
  }
  ```

  **Research Insights - Cap Implementation:**

  ```css
  /* Round caps via border-radius */
  .lcars-bar--cap-round-start { border-radius: 50% 0 0 50%; }
  .lcars-bar--cap-round-end { border-radius: 0 50% 50% 0; }

  /* Pointed caps via clip-path */
  .lcars-bar--cap-pointed-start {
    clip-path: polygon(10% 0, 100% 0, 100% 100%, 10% 100%, 0 50%);
  }
  .lcars-bar--cap-pointed-end {
    clip-path: polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%);
  }
  ```

---

- [x] **4.4 New Elements** (Video only) ✓ (2026-02-05)
  - **Number Display** - Animated counting with configurable format (deferred)
  - **Status Indicator** - Blinking lights with customizable patterns (deferred)
  - **Bar Graph** - Animated value display with segments (deferred)
  - **Video** - Remote-controlled playback (play/pause/seek/load) ✓

  ```typescript
  interface NumberElement {
    value: number;
    format: 'integer' | 'decimal' | 'percentage';
    animated: boolean;
  }

  interface StatusIndicatorElement {
    pattern: 'solid' | 'blink' | 'pulse' | 'scan';
    blinkSpeed: 'slow' | 'normal' | 'fast';
  }

  interface BarGraphElement {
    value: number;        // 0-100
    segments: number;     // number of segments (default: 10)
    orientation: 'horizontal' | 'vertical';
  }

  interface VideoElement {
    src: string;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    fit: 'contain' | 'cover' | 'fill';
  }
  ```

  **Research Insights - Number Display (GPU-Accelerated Animation):**

  ```typescript
  // packages/app/src/components/NumberDisplay.tsx
  function useAnimatedNumber(target: number, duration = 1000): number {
    const [current, setCurrent] = useState(target);
    const startRef = useRef<number>(current);
    const startTimeRef = useRef<number>(0);

    useEffect(() => {
      if (!animated) {
        setCurrent(target);
        return;
      }

      startRef.current = current;
      startTimeRef.current = performance.now();

      let frameId: number;
      function animate(now: number) {
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        setCurrent(startRef.current + (target - startRef.current) * eased);

        if (progress < 1) {
          frameId = requestAnimationFrame(animate);
        }
      }

      frameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frameId);
    }, [target, duration]);

    return current;
  }

  export function NumberDisplay({ value, format, animated }: NumberProps) {
    const displayValue = useAnimatedNumber(value);

    const formatted = useMemo(() => {
      switch (format) {
        case 'percentage': return `${Math.round(displayValue)}%`;
        case 'decimal': return displayValue.toFixed(2);
        default: return Math.round(displayValue).toString();
      }
    }, [displayValue, format]);

    return <span className="lcars-number">{formatted}</span>;
  }
  ```

  **Research Insights - Status Indicator (CSS-Only Animations):**

  ```css
  /* packages/app/src/components/StatusIndicator.css */
  .lcars-status { will-change: opacity; }

  .lcars-status--blink {
    animation: blink var(--blink-duration, 1s) step-end infinite;
  }
  .lcars-status--pulse {
    animation: pulse var(--blink-duration, 1s) ease-in-out infinite;
  }
  .lcars-status--scan {
    animation: scan var(--blink-duration, 2s) linear infinite;
  }

  @keyframes blink { 50% { opacity: 0; } }
  @keyframes pulse { 50% { opacity: 0.3; } }
  @keyframes scan {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }

  /* Speed variants */
  .lcars-status--slow { --blink-duration: 2s; }
  .lcars-status--normal { --blink-duration: 1s; }
  .lcars-status--fast { --blink-duration: 0.5s; }
  ```

  **Research Insights - Video Element (Command Queuing for Race Conditions):**

  ```typescript
  // packages/app/src/components/VideoElement.tsx
  type VideoCommand = { type: 'play' } | { type: 'pause' } | { type: 'seek'; time: number } | { type: 'load'; src: string };

  export function VideoElement({ elementId, src, fit, autoplay, loop, muted }: VideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const commandQueueRef = useRef<VideoCommand[]>([]);
    const processingRef = useRef(false);
    const { socket } = useDisplay();

    // Process commands sequentially to prevent race conditions
    const processQueue = useCallback(async () => {
      if (processingRef.current || commandQueueRef.current.length === 0) return;
      processingRef.current = true;

      const video = videoRef.current;
      if (!video) {
        processingRef.current = false;
        return;
      }

      const cmd = commandQueueRef.current.shift()!;

      try {
        switch (cmd.type) {
          case 'play':
            await video.play();
            break;
          case 'pause':
            video.pause();
            break;
          case 'seek':
            video.currentTime = cmd.time;
            break;
          case 'load':
            video.src = cmd.src;
            await video.load();
            break;
        }
      } catch (err) {
        console.error('Video command failed:', cmd, err);
      }

      processingRef.current = false;
      processQueue(); // Process next command
    }, []);

    // Listen for WebSocket commands
    useEffect(() => {
      function handleCommand(data: { elementId: string; command: string; time?: number; src?: string }) {
        if (data.elementId !== elementId) return;

        const cmd: VideoCommand = data.command === 'seek'
          ? { type: 'seek', time: data.time! }
          : data.command === 'load'
          ? { type: 'load', src: data.src! }
          : { type: data.command as 'play' | 'pause' };

        commandQueueRef.current.push(cmd);
        processQueue();
      }

      socket.on('videoCommand', handleCommand);
      return () => { socket.off('videoCommand', handleCommand); };
    }, [socket, elementId, processQueue]);

    // Report state changes back to server
    const reportState = useCallback((state: string) => {
      const video = videoRef.current;
      if (!video) return;
      socket.emit('videoState', {
        elementId,
        state,
        currentTime: video.currentTime,
      });
    }, [socket, elementId]);

    return (
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        style={{ objectFit: fit }}
        className="lcars-video"
        onPlay={() => reportState('playing')}
        onPause={() => reportState('paused')}
        onEnded={() => reportState('ended')}
      />
    );
  }
  ```

  **Performance Notes (from Performance Review):**
  - Video elements consume significant memory - limit to 2-3 per layout
  - Use `muted` by default to enable autoplay without user interaction
  - Consider preloading videos during layout load, not on-demand
  - Report video state sparingly (not on every timeupdate event)

---

- [ ] **4.5 Property Panel Enhancements**
  - Update property panel to support new element properties
  - Visual corner style picker
  - Width sliders for elbow arms

  **Research Insights - Element Registry Pattern (from Architecture Review):**

  ```typescript
  // packages/app/src/builder/elementRegistry.ts
  interface ElementDefinition<T extends LayoutElement['type']> {
    type: T;
    displayName: string;
    defaultProps: Partial<Extract<LayoutElement, { type: T }>>;
    PropertyEditor: React.ComponentType<{ element: Extract<LayoutElement, { type: T }> }>;
    Renderer: React.ComponentType<{ element: Extract<LayoutElement, { type: T }> }>;
  }

  const registry = new Map<string, ElementDefinition<any>>();

  export function registerElement<T extends LayoutElement['type']>(def: ElementDefinition<T>) {
    registry.set(def.type, def);
  }

  export function getElementDefinition(type: string) {
    return registry.get(type);
  }

  // Register all elements
  registerElement({
    type: 'elbow',
    displayName: 'Elbow',
    defaultProps: { direction: 'TL', verticalWidth: 1, horizontalWidth: 1 },
    PropertyEditor: ElbowPropertyEditor,
    Renderer: Elbow,
  });
  // ... register other elements
  ```

  This pattern makes adding new elements straightforward without modifying switch statements.

**Success Criteria:**
- Elbows can have asymmetric arm widths
- Buttons support mixed corner styles (round/square)
- 4 new element types available
- Property panel supports all new options

**TypeScript Architecture (from TypeScript Review):**

Use discriminated unions for type-safe element handling:

```typescript
// packages/shared/src/types.ts
type BaseElement = {
  id: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  color: string;
};

type ElbowElement = BaseElement & {
  type: 'elbow';
  direction: 'TL' | 'TR' | 'BL' | 'BR';
  verticalWidth: number;
  horizontalWidth: number;
};

type ButtonElement = BaseElement & {
  type: 'button';
  label: string;
  leftCorner: 'round' | 'square';
  rightCorner: 'round' | 'square';
};

type VideoElement = BaseElement & {
  type: 'video';
  src: string;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  fit: 'contain' | 'cover' | 'fill';
};

// ... other element types

export type LayoutElement =
  | ElbowElement
  | ButtonElement
  | BarElement
  | FrameElement
  | TextElement
  | NumberElement
  | StatusElement
  | BarGraphElement
  | VideoElement;

// Type guard usage
function renderElement(element: LayoutElement) {
  switch (element.type) {
    case 'elbow':
      // TypeScript knows element is ElbowElement here
      return <Elbow {...element} />;
    case 'video':
      // TypeScript knows element is VideoElement here
      return <VideoElement {...element} />;
    // ...
  }
}
```

**React 19 Patterns Applied (from React Review):**

```typescript
// Use useTransition for non-urgent updates
function PropertyPanel({ element }: Props) {
  const [isPending, startTransition] = useTransition();
  const { updateElement } = useBuilder();

  const handleColorChange = (color: string) => {
    startTransition(() => {
      updateElement(element.id, { color });
    });
  };

  return (
    <div className={isPending ? 'property-panel--updating' : ''}>
      {/* ... */}
    </div>
  );
}

// Memoize context value (from project learnings)
const value = useMemo(() => ({
  layout: state.layout,
  globalState: state.globalState,
  // ... other values
}), [state.layout, state.globalState]);
```

**Edge Cases & Race Conditions (from Race Condition Review):**

1. **Animation Interruption** - When value changes mid-animation:
   ```typescript
   // Cancel previous animation before starting new one
   useEffect(() => {
     const controller = new AbortController();
     animate(target, controller.signal);
     return () => controller.abort();
   }, [target]);
   ```

2. **Video Command Conflicts** - Multiple rapid commands:
   - Use command queue pattern (shown above)
   - Dedupe redundant commands (skip pause if already paused)

3. **Socket Reconnection** - Elements may miss state:
   - Request full state sync on reconnect
   - Server should cache current video states

---

## Future Roadmap (v3+)

Add based on real usage feedback:

### Interactive Elements
- Slider (draggable value control)
- Toggle (on/off switch)
- Data grid (scrolling rows)

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
- [x] Server accepts 15+ WebSocket connections
- [x] State changes propagate within 100ms
- [x] 5 display elements render correctly
- [x] Builder creates layouts via drag-drop
- [x] Operator panel triggers state changes
- [x] Layouts persist as JSON files

### Should Have
- [x] Touch feedback < 50ms ✓ (CSS :active with GPU-accelerated filter/transform)
- [x] 60fps animations ✓ (CSS transitions/keyframes, GPU-accelerated)
- [x] Auto-reconnect on disconnect
- [x] 10-level undo in builder

### Quality
- [x] TypeScript strict mode
- [x] Works in Chromium
- [x] No console errors in normal operation

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
- LCARS Big Picture: https://elonn.com/big-picture.html
- Design assets: `design/*.jpg`, `design/*.webp`

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
  type: 'elbow' | 'bar' | 'frame' | 'button' | 'text' | 'number' | 'status' | 'bargraph' | 'video';
  col: number;      // 0-11 grid column
  row: number;      // grid row
  colSpan: number;  // width in columns
  rowSpan: number;  // height in rows
  color: string;

  // Elbow props
  direction?: 'TL' | 'TR' | 'BL' | 'BR';
  verticalWidth?: number;    // width of vertical arm (default: 1)
  horizontalWidth?: number;  // width of horizontal arm (default: 1)

  // Bar props
  orientation?: 'horizontal' | 'vertical';
  startCap?: 'round' | 'square' | 'pointed';
  endCap?: 'round' | 'square' | 'pointed';

  // Button props
  label?: string;
  leftCorner?: 'round' | 'square';   // default: 'round'
  rightCorner?: 'round' | 'square';  // default: 'round'

  // Text props (uses label)

  // Number props
  value?: number;
  format?: 'integer' | 'decimal' | 'percentage';
  animated?: boolean;

  // Status indicator props
  pattern?: 'solid' | 'blink' | 'pulse' | 'scan';
  blinkSpeed?: 'slow' | 'normal' | 'fast';

  // Bar graph props
  segments?: number;  // default: 10

  // Video props
  src?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  fit?: 'contain' | 'cover' | 'fill';
}

type GlobalState = 'normal' | 'alert' | 'active' | 'damaged';
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

**Phases 1-4 Complete.** (2026-02-06)

### Phase 4 Summary (Completed)

1. ✓ **4.4a Video Element** - WebSocket-controlled video with command queue pattern
2. ✓ **4.1 Asymmetric Elbows** - SVG path generation for true L-shapes
3. ✓ **4.2 Button Corner Styles** - Per-corner border-radius (round/square)
4. ✓ **4.3 Bar End Caps** - Round/square/pointed caps with clip-path

### Remaining Phase 4 (Deferred to v2)

- **4.4b Number, StatusIndicator, BarGraph** - Add when actually needed
- **4.5 Element Registry Pattern** - Optional refactor for maintainability

### Future Work

See "Future Roadmap (v3+)" for additional features including:
- Interactive elements (Slider, Toggle, Data grid)
- Service Worker offline caching
- Scripted sequences
- Security hardening
