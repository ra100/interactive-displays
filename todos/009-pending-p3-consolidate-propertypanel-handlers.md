---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, refactoring, react, dry]
dependencies: []
---

# P3: Consolidate PropertyPanel Handlers

## Problem Statement

PropertyPanel has 10+ separate `useCallback` handlers that follow identical patterns. This is verbose and could be consolidated.

## Findings

**Location:** `/packages/app/src/builder/PropertyPanel.tsx`, lines 46-140

**Current pattern (repeated 10+ times):**
```typescript
const handleColorChange = useCallback((color: string) => {
  if (selectedElementId) {
    updateElement(selectedElementId, { color });
  }
}, [selectedElementId, updateElement]);
```

## Proposed Solution

Consolidate to 2 generic handlers:

```typescript
const updateField = useCallback(
  <K extends keyof LayoutElement>(field: K, value: LayoutElement[K]) => {
    if (selectedElementId) {
      updateElement(selectedElementId, { [field]: value });
    }
  },
  [selectedElementId, updateElement]
);

const updateNumericField = useCallback(
  (field: string, value: number, min = 0) => {
    if (selectedElementId && !Number.isNaN(value) && value >= min) {
      updateElement(selectedElementId, { [field]: value });
    }
  },
  [selectedElementId, updateElement]
);
```

**Estimated savings:** ~35 lines

## Acceptance Criteria

- [ ] Reduce to 2-3 generic handlers
- [ ] Update all usages in JSX
- [ ] Maintain same functionality
- [ ] No performance regression

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from simplicity review | Generic handlers reduce duplication |
