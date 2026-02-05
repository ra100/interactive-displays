---
status: pending
priority: p2
issue_id: "007"
tags: [reliability, code-review, server, socket-io]
dependencies: []
---

# No Error Handling in Socket Event Handlers

## Problem Statement

Async operations inside socket handlers have no try/catch. If operations fail, clients receive no feedback.

**Why it matters:** Silent failures create poor UX and make debugging difficult.

## Findings

**Location:** `packages/server/src/index.ts:46-56, 66-79`

```typescript
socket.on("identify", async (screenId) => {
  // No try/catch - if getLayout fails, client gets nothing
  const layout = await getLayout("default");
  if (layout) {
    socket.emit("layout", layout);
  }
});
```

## Proposed Solutions

### Option A: Add Error Events

```typescript
// In types.ts
export interface ServerToClientEvents {
  // ...existing
  error: (code: string, message: string) => void;
}

// In index.ts
socket.on("identify", async (screenId) => {
  try {
    connectedScreens.set(socket.id, screenId);
    broadcastScreens();
    const layout = await getLayout("default");
    if (layout) {
      socket.emit("layout", layout);
    }
  } catch (error) {
    console.error("Failed to handle identify:", error);
    socket.emit("error", "IDENTIFY_FAILED", "Failed to load layout");
  }
});
```

**Effort:** Small (20 min)
**Risk:** Low

## Acceptance Criteria

- [ ] All async socket handlers have try/catch
- [ ] Error event defined in types
- [ ] Client receives meaningful error on failure
- [ ] Errors logged server-side

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during TypeScript review |
