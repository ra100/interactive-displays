---
title: "Extracting Shared Utility Functions"
category: architecture
tags: [dry, refactoring, utilities, code-reuse]
module: app/components
symptom: "Same logic copy-pasted across multiple files"
root_cause: "Quick implementation without identifying shared patterns"
severity: low
date_resolved: 2026-02-05
---

# Extracting Shared Utility Functions

## Problem

The same logic duplicated across multiple components:

```typescript
// Duplicated in Elbow.tsx, Bar.tsx, Frame.tsx, Button.tsx, Text.tsx
const stateClass =
  globalState === "alert"
    ? "state--alert"
    : globalState === "damaged"
      ? "state--damaged"
      : globalState === "active"
        ? "state--active"
        : "";
```

### Why this is a problem:
1. **Maintenance burden** - Change in one place requires 5 updates
2. **Inconsistency risk** - Easy to update 4 of 5 files
3. **Code bloat** - ~28 lines of duplicated logic
4. **Harder to test** - Logic embedded in components

## Solution

### 1. Create utility function

```typescript
// utils/getStateClass.ts
import type { GlobalState } from "@interactive-displays/shared";

const STATE_CLASS_MAP: Record<GlobalState, string> = {
  normal: "",
  alert: "state--alert",
  active: "state--active",
  damaged: "state--damaged",
};

export function getStateClass(globalState: GlobalState): string {
  return STATE_CLASS_MAP[globalState];
}
```

### 2. Update all components

```typescript
// Before (in each component)
const stateClass =
  globalState === "alert"
    ? "state--alert"
    : globalState === "damaged"
      ? "state--damaged"
      : globalState === "active"
        ? "state--active"
        : "";

// After
import { getStateClass } from "../utils/getStateClass";

const stateClass = getStateClass(globalState);
```

### Benefits of the utility:
- **Type-safe**: Uses `Record<GlobalState, string>` - TypeScript ensures all cases covered
- **Testable**: Can unit test the mapping independently
- **Single source**: Add a new state? Update one file
- **Readable**: Map is self-documenting

## When to Extract

Extract a utility when you see:

| Pattern | Action |
|---------|--------|
| Same 3+ lines in 2+ files | Extract utility function |
| Same conditional logic repeated | Extract with clear naming |
| Magic values repeated | Extract as constants |
| Same transformation applied | Extract pure function |

### Don't over-extract

```typescript
// Too granular - just inline this
function addOne(n: number): number {
  return n + 1;
}

// Appropriate - meaningful abstraction
function getStateClass(state: GlobalState): string {
  return STATE_CLASS_MAP[state];
}
```

## Key Insight

- **Rule of three**: Extract after third duplication, not first
- **Name the concept**: Good utility names describe *what*, not *how*
- **Keep utilities pure**: No side effects, predictable output
- **Co-locate**: Put utilities near where they're used (`utils/` in same package)

## References

- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- Original todo: 004-pending-p2-extract-state-class-utility
