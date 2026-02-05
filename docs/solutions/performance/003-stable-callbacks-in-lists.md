---
title: "Stable Callbacks in List Rendering"
category: performance
tags: [react, callbacks, lists, memo, performance, rendering]
module: app/builder
symptom: "All list items re-render on any state change"
root_cause: "Inline arrow functions create new references every render"
severity: medium
date_resolved: 2026-02-05
---

# Stable Callbacks in List Rendering

## Problem

Creating inline callbacks in `.map()` creates O(n) new function references per render:

```typescript
// BAD - new function for EVERY element on EVERY render
{layout.elements.map((element) => (
  <DraggableElement
    key={element.id}
    element={element}
    isSelected={selectedElementId === element.id}
    onSelect={() => selectElement(element.id)}  // New function!
  />
))}
```

### Why this matters:
1. Each `<DraggableElement>` receives a new `onSelect` prop reference
2. Even with `React.memo`, props changed = component re-renders
3. With 50 elements, that's 50 unnecessary re-renders per state change

## Solution

### Option A: Pass ID and handle in child (Recommended)

Change the callback signature to accept the element ID:

```typescript
// Parent - stable callback reference
interface DraggableElementProps {
  element: LayoutElement;
  isSelected: boolean;
  onSelect: (id: string) => void;  // Takes ID instead of closure
}

// In Canvas
{layout.elements.map((element) => (
  <DraggableElement
    key={element.id}
    element={element}
    isSelected={selectedElementId === element.id}
    onSelect={selectElement}  // Same reference every render!
  />
))}

// Child calls with its ID
function DraggableElement({ element, onSelect }: DraggableElementProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id);  // Pass ID when called
    },
    [onSelect, element.id]
  );
  // ...
}
```

### Option B: Memoize callbacks with useMemo

Create a map of callbacks keyed by element ID:

```typescript
// Create stable callbacks for each element
const selectCallbacks = useMemo(() => {
  const callbacks: Record<string, () => void> = {};
  for (const element of layout.elements) {
    callbacks[element.id] = () => selectElement(element.id);
  }
  return callbacks;
}, [layout.elements, selectElement]);

// Use the pre-created callback
{layout.elements.map((element) => (
  <DraggableElement
    onSelect={selectCallbacks[element.id]}
  />
))}
```

**Option A is preferred** because:
- Simpler - no extra memoization layer
- Works naturally with `useCallback` in child
- Better for dynamic lists (no stale callbacks)

## Key Insight

- **Stable references** enable `React.memo` to skip re-renders
- **Pass data down, call with data** instead of creating closures
- **Pattern**: `onAction: (id) => void` instead of `onAction: () => void`

**Common places this applies:**
- List items with click handlers
- Table rows with edit/delete buttons
- Drag-and-drop sortable items
- Any repeated component with callbacks

## References

- [React memo](https://react.dev/reference/react/memo)
- Original todo: 003-pending-p2-fix-canvas-inline-callback
