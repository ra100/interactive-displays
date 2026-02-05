---
title: "Consolidating Handlers with Generic Functions"
category: architecture
tags: [react, useCallback, dry, typescript, generics]
module: app
symptom: "Many near-identical handler functions, verbose component code"
root_cause: "Creating separate callbacks for each field instead of generic handlers"
severity: low
date_resolved: 2026-02-05
---

# Consolidating Handlers with Generic Functions

## Problem

Property panels and forms often have many handlers that follow identical patterns:

```typescript
// BAD - 10+ nearly identical handlers
const handleColorChange = useCallback(
  (color: string) => {
    if (selectedId) updateElement(selectedId, { color });
  },
  [selectedId, updateElement]
);

const handleLabelChange = useCallback(
  (label: string) => {
    if (selectedId) updateElement(selectedId, { label });
  },
  [selectedId, updateElement]
);

const handleDirectionChange = useCallback(
  (direction: ElbowDirection) => {
    if (selectedId) updateElement(selectedId, { direction });
  },
  [selectedId, updateElement]
);

// ... 7 more handlers with same pattern
```

This creates:
1. Code duplication (~50+ lines of boilerplate)
2. Inconsistent validation across handlers
3. Higher maintenance burden

## Solution

### 1. Create a generic field update handler

```typescript
const updateField = useCallback(
  <K extends keyof LayoutElement>(field: K, value: LayoutElement[K]) => {
    if (selectedElementId) {
      updateElement(selectedElementId, { [field]: value } as Partial<LayoutElement>);
    }
  },
  [selectedElementId, updateElement]
);
```

### 2. Create a numeric handler with validation

```typescript
const updateNumericField = useCallback(
  (field: keyof LayoutElement, value: number, min = 0) => {
    if (selectedElementId && !Number.isNaN(value) && value >= min) {
      updateElement(selectedElementId, { [field]: value } as Partial<LayoutElement>);
    }
  },
  [selectedElementId, updateElement]
);
```

### 3. Keep special handlers for complex validation

```typescript
// Keep separate when validation has side effects (like error state)
const handleSrcChange = useCallback(
  (src: string) => {
    if (selectedElementId) {
      if (isValidVideoUrl(src)) {
        setSrcError(null);
        updateElement(selectedElementId, { src });
      } else {
        setSrcError("URL must use http, https, or blob protocol");
      }
    }
  },
  [selectedElementId, updateElement]
);
```

### 4. Update JSX to use generic handlers

```typescript
// Before - many handler references
onChange={(e) => handleColorChange(e.target.value)}
onChange={(e) => handleLabelChange(e.target.value)}
onChange={(e) => handleDirectionChange(e.target.value as ElbowDirection)}

// After - single generic handler
onClick={() => updateField("color", color.value)}
onChange={(e) => updateField("label", e.target.value)}
onChange={(e) => updateField("direction", e.target.value as ElbowDirection)}

// Numeric fields with validation
onChange={(e) => updateNumericField("col", parseInt(e.target.value, 10))}
onChange={(e) => updateNumericField("colSpan", parseInt(e.target.value, 10), 1)}
```

## Key Insight

- Generic handlers reduce 10+ callbacks to 2-3
- TypeScript generics ensure type safety
- Keep special handlers for complex validation with side effects
- Use min parameter for numeric validation
- Result: ~35 fewer lines, consistent validation

## Pattern Summary

| Handler Type | When to Use |
|--------------|-------------|
| `updateField<K>` | String, enum, boolean fields |
| `updateNumericField` | Number fields with min validation |
| Custom handler | Complex validation with UI feedback |

## References

- Original todo: 009-p3-consolidate-propertypanel-handlers
