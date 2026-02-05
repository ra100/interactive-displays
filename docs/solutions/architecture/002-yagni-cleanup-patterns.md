---
title: "YAGNI Cleanup Patterns"
category: architecture
tags: [yagni, cleanup, dead-code, refactoring]
module: all
symptom: "Unused code, duplicate definitions, premature features"
root_cause: "Building features 'just in case' or copying boilerplate"
severity: low
date_resolved: 2026-02-05
---

# YAGNI Cleanup Patterns

## Problem

Several YAGNI violations found during code review:

### 1. Unused REST endpoints
```typescript
// Built "just in case" but app only uses Socket.io
fastify.get("/api/layouts", async () => listLayouts());
fastify.get("/api/layouts/:id", ...);
fastify.post("/api/layouts", ...);
```

### 2. Unused function exports
```typescript
// deleteLayout() defined but never called
export async function deleteLayout(id: string): Promise<boolean> { ... }

// listLayouts() only used by REST endpoints
export async function listLayouts(): Promise<Layout[]> { ... }
```

### 3. Duplicate source of truth
```typescript
// Default layout in BOTH:
// - packages/server/data/layouts/default.json (committed file)
// - ensureDefaultLayout() function that recreates it
```

### 4. Unused context state
```typescript
// connectedScreens in context but no component uses it
const [connectedScreens, setConnectedScreens] = useState<string[]>([]);
```

### 5. Console.log in production code
```typescript
// Debug logs left in production code
console.log("Connected to server");
console.log("State updated:", state);
```

### 6. Inline styles that should be CSS
```typescript
// Large style objects recreated every render
const style: React.CSSProperties = {
  gridColumn: `${element.col + 1} / span ${element.colSpan}`,
  // ... 15 more properties
};
```

## Solution

### Remove unused code entirely
```diff
- export async function deleteLayout(id: string): Promise<boolean> { ... }
- export async function listLayouts(): Promise<Layout[]> { ... }
- fastify.get("/api/layouts", ...);
- fastify.post("/api/layouts", ...);
```

### Single source of truth
Keep committed `default.json`, remove `ensureDefaultLayout()` function.

### Remove unused state
```diff
- const [connectedScreens, setConnectedScreens] = useState<string[]>([]);
- newSocket.on("connectedScreens", setConnectedScreens);
```

### Use proper logging
Server: Use Fastify's built-in logger (`fastify.log.info()`)
Client: Remove console.log or use conditional debug mode

### Extract static styles to CSS
```css
/* DisplayScreen.css */
.display-element {
  border-radius: 8px;
  display: flex;
  /* ... static properties */
}
```

```typescript
// Only dynamic styles in component
const style = useMemo(() => ({
  gridColumn: `${element.col + 1} / span ${element.colSpan}`,
  backgroundColor: element.color,
}), [element.col, element.colSpan, element.color]);
```

## Key Insight

**YAGNI principle:** Don't build features until they're needed.

- Delete unused code - git history preserves it
- One source of truth - avoid duplicate definitions
- Remove debug code before commit
- Extract static values - CSS for styles, constants for config

**When reviewing code, ask:**
1. Is this code called from anywhere?
2. Is this the only place this value is defined?
3. Would a new developer understand why this exists?

## References

- [YAGNI - Martin Fowler](https://martinfowler.com/bliki/Yagni.html)
- Original todos: 011-018 (various cleanup items)
