---
name: display-builder
description: Visual layout editor and operator panel development. Use when working on drag-drop functionality, canvas, palette, property panel, or operator controls in packages/app/src/builder/.
metadata:
  project: interactive-displays
  role: builder-developer
---

# Display Builder Development

## Features

1. **Canvas** - 12-column grid, drop zone for elements
2. **Palette** - Draggable element types
3. **Property Panel** - Edit selected element
4. **Operator Panel** - State change buttons (80px+ height)

## Tech Stack

- @dnd-kit/core for drag-drop
- react-router-dom for /builder route
- React Context + useState for state
- 10-level undo (simple array)

## File Structure

```
packages/app/src/builder/
├── BuilderPage.tsx
├── Canvas.tsx
├── Palette.tsx
├── PropertyPanel.tsx
├── OperatorPanel.tsx
└── hooks/
    ├── useHistory.ts
    └── useLayoutSync.ts
```

## Grid System

```typescript
const GRID_COLUMNS = 12;
const CELL_SIZE = 60;

function snapToGrid(x: number, y: number) {
  return {
    col: Math.round(x / CELL_SIZE),
    row: Math.round(y / CELL_SIZE),
  };
}
```

## @dnd-kit Pattern

```typescript
import { DndContext, DragEndEvent } from '@dnd-kit/core';

function Canvas({ layout, onUpdate }: CanvasProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (active.data.current?.fromPalette) {
      // Create new element
    } else {
      // Move existing element
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {/* ... */}
    </DndContext>
  );
}
```

## Undo/Redo (10 Levels)

```typescript
const MAX_HISTORY = 10;

function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<T[]>([initial]);
  const [index, setIndex] = useState(0);

  const push = (value: T) => {
    const newHistory = [...history.slice(0, index + 1), value].slice(-MAX_HISTORY);
    setHistory(newHistory);
    setIndex(newHistory.length - 1);
  };

  const undo = () => index > 0 && setIndex(index - 1);
  const redo = () => index < history.length - 1 && setIndex(index + 1);

  return { current: history[index], push, undo, redo };
}
```

## Operator Panel

```typescript
function OperatorPanel() {
  const { globalState, setGlobalState } = useDisplay();
  const states: GlobalState[] = ['normal', 'alert', 'active', 'damaged'];

  return (
    <div className="operator-panel">
      {states.map(state => (
        <button
          key={state}
          className={globalState === state ? 'active' : ''}
          onClick={() => setGlobalState(state)}
          style={{ minHeight: '80px', minWidth: '150px' }}
        >
          {state.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

## Quality Checklist

- [ ] Elements snap to 12-column grid
- [ ] Drag from palette creates new element
- [ ] Click selects element
- [ ] Property panel edits selected element
- [ ] Undo/redo works (10 levels)
- [ ] Keyboard: Ctrl+Z undo, Ctrl+Shift+Z redo
- [ ] Operator buttons 80px+ height
- [ ] Current state visually indicated
- [ ] Save persists to server
