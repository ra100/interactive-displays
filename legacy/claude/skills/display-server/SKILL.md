---
name: display-server
description: Backend development for the interactive display WebSocket server. Use when working on packages/server/, implementing Socket.io events, layout file persistence, or global state management.
metadata:
  project: interactive-displays
  role: server-developer
---

# Display Server Development

## Tech Stack

- Node.js 24 LTS
- Fastify 4.x
- Socket.io 4.x
- TypeScript strict mode
- JSON file persistence

## Architecture Rules

1. **Single namespace** - No Socket.io namespaces or rooms
2. **Broadcast all** - `io.emit()` to all clients
3. **Simple state** - `globalState` is a string: `'normal' | 'alert' | 'active' | 'damaged'`
4. **Atomic writes** - Write to temp file, then rename

## File Structure

```
packages/server/src/
├── index.ts      # Entry, Fastify + Socket.io setup
├── socket.ts     # Socket event handlers
├── layouts.ts    # Layout CRUD
└── types.ts      # Shared types
```

## Socket Events

```typescript
// Server → Client
io.emit('state', globalState);
io.emit('layout', layout);

// Client → Server
socket.on('identify', (screenId) => {});
socket.on('stateChange', (newState) => {});
socket.on('saveLayout', (layout) => {});
```

## Types

```typescript
export type GlobalState = 'normal' | 'alert' | 'active' | 'damaged';

export interface Layout {
  id: string;
  name: string;
  theme?: string;  // Visual theme identifier
  elements: LayoutElement[];
}

export interface LayoutElement {
  id: string;
  type: 'elbow' | 'bar' | 'frame' | 'button' | 'text';
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  color: string;
  direction?: 'TL' | 'TR' | 'BL' | 'BR';
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}
```

## Patterns

### Fastify + Socket.io

```typescript
import Fastify from 'fastify';
import { Server } from 'socket.io';

const fastify = Fastify();
const io = new Server(fastify.server, { cors: { origin: '*' } });

let globalState: GlobalState = 'normal';

io.on('connection', (socket) => {
  socket.emit('state', globalState);
  socket.on('stateChange', (state: GlobalState) => {
    globalState = state;
    io.emit('state', globalState);
  });
});
```

### Atomic Writes

```typescript
async function saveLayout(layout: Layout): Promise<void> {
  const filePath = join(LAYOUTS_DIR, `${layout.id}.json`);
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(layout, null, 2));
  await rename(tempPath, filePath);
}
```

## Quality Checklist

- [ ] No `any` types
- [ ] All socket events typed
- [ ] Atomic file writes
- [ ] Layout IDs validated (alphanumeric, hyphen, underscore only)
- [ ] Error handling on file operations
