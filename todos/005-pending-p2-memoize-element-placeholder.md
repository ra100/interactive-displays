---
status: pending
priority: p2
issue_id: "005"
tags: [performance, code-review, react]
dependencies: ["004"]
---

# Missing Memoization in ElementPlaceholder

## Problem Statement

`ElementPlaceholder` component re-renders on every context change (including unrelated ones like `connectedScreens`). Style objects are recreated on every render.

**Why it matters:** With 50+ elements, state changes cause 50+ unnecessary re-renders.

## Findings

**Location:** `packages/app/src/display/DisplayScreen.tsx:9-41`

```typescript
function ElementPlaceholder({ element }: { element: LayoutElement }) {
  const { globalState } = useDisplay();  // Subscribes to ALL context
  const style: React.CSSProperties = { ... };  // Recreated every render
}
```

## Proposed Solutions

### Option A: memo + useMemo + Props (Recommended)

```typescript
const ElementPlaceholder = memo(function ElementPlaceholder({
  element,
  globalState
}: {
  element: LayoutElement;
  globalState: GlobalState;
}) {
  const style = useMemo(() => ({
    gridColumn: `${element.col + 1} / span ${element.colSpan}`,
    // ... rest
  }), [element, globalState]);

  return <div style={style}>{element.label || element.type.toUpperCase()}</div>;
});

// In DisplayScreen:
{layout?.elements.map((element) => (
  <ElementPlaceholder key={element.id} element={element} globalState={globalState} />
))}
```

**Effort:** Small (15 min)
**Risk:** Low

## Acceptance Criteria

- [ ] ElementPlaceholder wrapped in React.memo
- [ ] Style objects memoized
- [ ] globalState passed as prop (not from context)
- [ ] Re-renders only when props change

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during performance review |
