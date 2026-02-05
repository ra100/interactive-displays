---
title: "Caching Frequently Accessed Data"
category: performance
tags: [caching, file-io, memory, socket-io]
module: server
symptom: "File system read on every socket connection"
root_cause: "No caching for default layout accessed on every identify event"
severity: medium
date_resolved: 2026-02-05
---

# Caching Frequently Accessed Data

## Problem

Every screen identification triggered a file system read:

```typescript
// BAD - disk I/O on every connection
socket.on("identify", async (screenId) => {
  const layout = await getLayout("default"); // Reads file every time
  if (layout) {
    socket.emit("layout", layout);
  }
});
```

With many screens reconnecting (network issues, browser refreshes), this causes unnecessary disk I/O.

## Solution

Cache frequently accessed data in memory with invalidation on write:

```typescript
// Module-level cache
let cachedDefaultLayout: Layout | null = null;

// Pre-load on startup
const start = async () => {
  cachedDefaultLayout = await getLayout("default");
  // ...
};

// Use cache on identify
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
    cachedDefaultLayout = saved; // Update cache
  }
  io.emit("layout", saved);
});
```

## Key Insight

For read-heavy, write-rare data (like default layouts), simple in-memory caching with write-through invalidation is sufficient. No need for Redis or TTL - just update the cache when the source changes.

## References

- Original todo: 009-p2-cache-default-layout
