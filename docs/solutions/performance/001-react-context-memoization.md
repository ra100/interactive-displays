---
title: "Memoizing React Context Values and Components"
category: performance
tags: [react, context, usememo, memo, useref, hooks]
module: app/context
symptom: "All context consumers re-render on every state change"
root_cause: "Context value object recreated on every render, socket in useState"
severity: medium
date_resolved: 2026-02-05
---

# Memoizing React Context Values and Components

## Problem

Multiple performance issues in React context:

### 1. Context value recreated every render
```typescript
// BAD - new object reference every render
const value: DisplayContextValue = {
  globalState,
  layout,
  isConnected,
  setGlobalState,
  saveLayout,
  identify,
};
```

### 2. Socket in useState forces callback recreation
```typescript
// BAD - socket in state means callbacks depend on it
const [socket, setSocket] = useState<Socket | null>(null);

const setGlobalState = useCallback((state) => {
  socket?.emit("stateChange", state);
}, [socket]); // Recreated when socket changes
```

### 3. Components subscribe to entire context
```typescript
// BAD - re-renders on ANY context change
function ElementPlaceholder({ element }) {
  const { globalState } = useDisplay(); // Subscribes to everything
}
```

## Solution

### 1. Wrap context value in useMemo
```typescript
const value = useMemo<DisplayContextValue>(
  () => ({
    globalState,
    layout,
    isConnected,
    setGlobalState,
    saveLayout,
    identify,
  }),
  [globalState, layout, isConnected, setGlobalState, saveLayout, identify]
);
```

### 2. Use useRef for socket
```typescript
const socketRef = useRef<Socket | null>(null);

const setGlobalState = useCallback((state) => {
  socketRef.current?.emit("stateChange", state);
}, []); // Empty deps - never recreated
```

### 3. Pass specific values as props + React.memo
```typescript
const ElementPlaceholder = memo(function ElementPlaceholder({
  element,
  globalState, // Passed as prop, not from context
}: ElementPlaceholderProps) {
  const style = useMemo(() => ({
    gridColumn: `${element.col + 1} / span ${element.colSpan}`,
    // ...
  }), [element.col, element.colSpan, /* specific deps */]);

  return <div style={style}>{element.label}</div>;
});

// Parent passes globalState explicitly
{layout?.elements.map((element) => (
  <ElementPlaceholder key={element.id} element={element} globalState={globalState} />
))}
```

## Key Insight

- `useMemo` for object stability in context providers
- `useRef` for values only used in callbacks (not rendering)
- `React.memo` + props for components that receive context-derived values
- Memoize computed values (styles) inside memoized components

## References

- Original todos: 004-p2-context-usememo, 005-p2-memoize-element-placeholder, 016-p3-socket-useref
