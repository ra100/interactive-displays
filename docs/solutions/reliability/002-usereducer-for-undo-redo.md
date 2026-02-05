---
title: "Using useReducer for Undo/Redo State Management"
category: reliability
tags: [react, usereducer, undo, redo, state-management, hooks]
module: app/builder
symptom: "Undo/redo corrupts state, rapid edits cause data loss"
root_cause: "useState with multiple interdependent values causes stale closure bugs"
severity: high
date_resolved: 2026-02-05
---

# Using useReducer for Undo/Redo State Management

## Problem

Implementing undo/redo with `useState` for multiple related values leads to bugs:

### Stale closure capturing index
```typescript
// BAD - historyIndex captured at callback creation time
const [history, setHistory] = useState<Layout[]>([]);
const [historyIndex, setHistoryIndex] = useState(-1);

const pushHistory = useCallback((newLayout: Layout) => {
  setHistory((h) => {
    // historyIndex here may be stale!
    const newHistory = [...h.slice(0, historyIndex + 1), newLayout];
    return newHistory;
  });
  setHistoryIndex((i) => i + 1);
}, [historyIndex]); // Dependency causes frequent recreation

const undo = useCallback(() => {
  if (historyIndex < 0) return;
  setHistoryIndex((i) => i - 1);
  // Now historyIndex and setLayout are out of sync!
  setLayout(history[historyIndex - 1]);
}, [historyIndex, history]);
```

### Problems with this approach:
1. **State split across multiple hooks** - `history`, `historyIndex`, `layout` must stay in sync
2. **Callbacks capture stale values** - Rapid edits can corrupt history
3. **Race conditions** - `setHistoryIndex` and `setLayout` aren't atomic

## Solution

Use `useReducer` to manage all related state atomically:

```typescript
interface BuilderState {
  layout: Layout;
  selectedElementId: string | null;
  past: Layout[];    // States before current
  future: Layout[];  // States for redo
}

type BuilderAction =
  | { type: "ADD_ELEMENT"; element: LayoutElement }
  | { type: "UPDATE_ELEMENT"; id: string; updates: Partial<LayoutElement> }
  | { type: "DELETE_ELEMENT"; id: string }
  | { type: "UNDO" }
  | { type: "REDO" };

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "ADD_ELEMENT": {
      const newLayout = {
        ...state.layout,
        elements: [...state.layout.elements, action.element],
      };
      return {
        ...state,
        layout: newLayout,
        selectedElementId: action.element.id,
        past: [...state.past, state.layout].slice(-MAX_HISTORY),
        future: [], // Clear redo on new action
      };
    }

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        ...state,
        layout: previous,
        past: state.past.slice(0, -1),
        future: [state.layout, ...state.future].slice(0, MAX_HISTORY),
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        ...state,
        layout: next,
        past: [...state.past, state.layout].slice(-MAX_HISTORY),
        future: state.future.slice(1),
      };
    }
    // ... other cases
  }
}
```

### Usage in provider
```typescript
export function BuilderProvider({ children, initialLayout }: BuilderProviderProps) {
  const [state, dispatch] = useReducer(builderReducer, {
    layout: initialLayout ?? DEFAULT_LAYOUT,
    selectedElementId: null,
    past: [],
    future: [],
  });

  // Callbacks are stable - no dependencies on state
  const addElement = useCallback((element: LayoutElement) => {
    dispatch({ type: "ADD_ELEMENT", element });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  // ...
}
```

## Key Insight

- **Atomic transitions**: All state changes happen in one function call
- **No stale closures**: Reducer receives current state, not captured values
- **Predictable**: Each action type has clear, testable behavior
- **Past/future pattern**: Simpler than single array with index tracking

**When to use useReducer:**
- Multiple state values that must stay synchronized
- Complex update logic (undo/redo, form validation)
- State transitions that depend on previous state

## References

- [React useReducer docs](https://react.dev/reference/react/useReducer)
- Original todo: 001-pending-p1-fix-undo-redo-implementation
