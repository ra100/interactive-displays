---
title: "Error Handling Patterns for File and Socket Operations"
category: reliability
tags: [error-handling, exceptions, file-io, socket-io, debugging]
module: server
symptom: "Silent failures, errors swallowed, no client feedback"
root_cause: "Catch blocks returning null/empty without distinguishing error types"
severity: medium
date_resolved: 2026-02-05
---

# Error Handling Patterns for File and Socket Operations

## Problem

### 1. Silent error swallowing in file operations
```typescript
// BAD - hides permission errors, disk full, corrupted JSON
export async function getLayout(id: string): Promise<Layout | null> {
  try {
    const content = await readFile(layoutPath(id), "utf-8");
    return JSON.parse(content);
  } catch {
    return null; // ALL errors treated as "not found"
  }
}
```

### 2. No error feedback to socket clients
```typescript
// BAD - client gets nothing on failure
socket.on("getLayout", async (layoutId) => {
  const layout = await getLayout(layoutId);
  if (layout) {
    socket.emit("layout", layout);
  }
  // If getLayout fails, client is left hanging
});
```

### 3. Unhandled promise on server start
```typescript
// BAD - startup errors vanish
start(); // No .catch()
```

## Solution

### 1. Distinguish error types in file operations
```typescript
export async function getLayout(id: string): Promise<Layout | null> {
  try {
    const safePath = layoutPath(id);
    const content = await readFile(safePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    // Expected: file not found
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Validation error - let it propagate
    if ((error as Error).name === "ZodError") {
      throw error;
    }
    // Corrupted file
    if (error instanceof SyntaxError) {
      throw new Error(`Corrupted layout file for ${id}: ${error.message}`);
    }
    // Unknown error - re-throw
    throw error;
  }
}
```

### 2. Add error events to socket handlers
```typescript
// types.ts - add error event
export interface ServerToClientEvents {
  state: (state: GlobalState) => void;
  layout: (layout: Layout) => void;
  error: (code: string, message: string) => void;
}

// index.ts - emit errors to client
socket.on("getLayout", async (layoutId) => {
  try {
    const validLayoutId = validateLayoutId(layoutId);
    const layout = await getLayout(validLayoutId);
    if (layout) {
      socket.emit("layout", layout);
    } else {
      socket.emit("error", "LAYOUT_NOT_FOUND", "Layout not found");
    }
  } catch (error) {
    if (error instanceof ZodError) {
      socket.emit("error", "INVALID_LAYOUT_ID", "Invalid layout ID format");
      return;
    }
    fastify.log.error(`Error handling getLayout: ${error}`);
    socket.emit("error", "GET_LAYOUT_FAILED", "Failed to get layout");
  }
});
```

### 3. Handle startup errors
```typescript
start().catch((err) => {
  fastify.log.error("Server failed to start:", err);
  process.exit(1);
});
```

## Key Insight

- Return `null` only for expected "not found" cases
- Throw/propagate errors for unexpected failures
- Always provide error feedback to clients (socket events, HTTP status codes)
- Use structured error codes for client-side handling
- Log errors server-side for debugging

## References

- Original todos: 006-p2-error-handling, 007-p2-socket-error-handling, 010-p2-server-start-error
