---
status: pending
priority: p2
issue_id: "004"
tags: [performance, code-review, react]
dependencies: []
---

# React Context Value Recreated Every Render

## Problem Statement

The DisplayContext value object is recreated on every render, causing all consumers to re-render even when no values actually changed.

**Why it matters:** Unnecessary re-renders degrade performance, especially with many elements.

## Findings

**Location:** `packages/app/src/context/DisplayContext.tsx:113-121`

```typescript
const value: DisplayContextValue = {
  globalState,
  layout,
  connectedScreens,
  isConnected,
  setGlobalState,
  saveLayout,
  identify,
};
```

New object reference created on every render → all `useDisplay()` consumers re-render.

## Proposed Solutions

### Option A: useMemo (Recommended)

```typescript
const value = useMemo<DisplayContextValue>(
  () => ({
    globalState,
    layout,
    connectedScreens,
    isConnected,
    setGlobalState,
    saveLayout,
    identify,
  }),
  [globalState, layout, connectedScreens, isConnected, setGlobalState, saveLayout, identify]
);
```

**Effort:** Small (5 min)
**Risk:** Low

## Acceptance Criteria

- [ ] Context value wrapped in useMemo
- [ ] Consumers only re-render when values change
- [ ] No functional regressions

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during performance review |
