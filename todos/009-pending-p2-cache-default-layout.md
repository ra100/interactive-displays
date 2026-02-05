---
status: pending
priority: p2
issue_id: "009"
tags: [performance, code-review, server]
dependencies: []
---

# File I/O on Every Socket Identify

## Problem Statement

Every screen identification triggers a file system read for the default layout. With many screens reconnecting, this causes unnecessary disk I/O.

**Why it matters:** Performance degrades with many simultaneous connections.

## Findings

**Location:** `packages/server/src/index.ts:51-55`

```typescript
socket.on("identify", async (screenId) => {
  // Reads from disk every time
  const layout = await getLayout("default");
});
```

## Proposed Solutions

### Option A: In-Memory Cache

```typescript
let cachedDefaultLayout: Layout | null = null;

socket.on("identify", async (screenId) => {
  if (!cachedDefaultLayout) {
    cachedDefaultLayout = await getLayout("default");
  }
  if (cachedDefaultLayout) {
    socket.emit("layout", cachedDefaultLayout);
  }
});

// Invalidate on save
socket.on("saveLayout", async (layout) => {
  const saved = await saveLayout(layout);
  if (saved.id === "default") {
    cachedDefaultLayout = saved;
  }
  io.emit("layout", saved);
});
```

**Effort:** Small (15 min)
**Risk:** Low

## Acceptance Criteria

- [ ] Default layout cached in memory
- [ ] Cache invalidated on layout save
- [ ] File only read once on startup/first request

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during performance review |
