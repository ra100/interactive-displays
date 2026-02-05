---
title: "Runtime Input Validation for Socket.io Events"
category: security
tags: [socket-io, validation, zod, typescript, runtime]
module: server
symptom: "Socket handlers accept any data without validation"
root_cause: "TypeScript types provide compile-time hints but zero runtime protection"
severity: critical
date_resolved: 2026-02-05
---

# Runtime Input Validation for Socket.io Events

## Problem

Socket.io event handlers accepted user input without runtime validation:

```typescript
// VULNERABLE - TypeScript types don't protect at runtime
socket.on("stateChange", (newState) => {
  globalState = newState; // Could be object, array, script injection, anything
});

socket.on("saveLayout", async (layout) => {
  await saveLayout(layout); // Writes arbitrary data to filesystem
});
```

**Attack vectors:**
- State injection: `socket.emit('stateChange', '<script>alert(1)</script>')`
- DoS via large payloads: `socket.emit('saveLayout', { elements: new Array(1000000) })`
- Prototype pollution: `socket.emit('saveLayout', { __proto__: { polluted: true } })`

## Solution

Use Zod schemas for runtime validation on all socket events:

```typescript
// validation.ts
export const GlobalStateSchema = z.enum(["normal", "alert", "active", "damaged"]);

export const LayoutElementSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["elbow", "bar", "frame", "button", "text"]),
  col: z.number().int().min(0).max(11),
  // ... with size limits
});

export const LayoutSchema = z.object({
  id: LayoutIdSchema.optional(),
  name: z.string().min(1).max(200),
  elements: z.array(LayoutElementSchema).max(500), // Prevent DoS
});

// index.ts
socket.on("stateChange", (newState) => {
  try {
    const validState = validateGlobalState(newState);
    globalState = validState;
    io.emit("state", globalState);
  } catch (error) {
    if (error instanceof ZodError) {
      socket.emit("error", "INVALID_STATE", "Invalid state value");
      return;
    }
    throw error;
  }
});
```

## Key Insight

TypeScript types evaporate at runtime. Any data from external sources (sockets, HTTP, files) needs runtime validation. Zod provides both runtime validation AND TypeScript type inference from the same schema.

## References

- [Zod Documentation](https://zod.dev/)
- Original todos: 002-p1-input-validation, 007-p2-socket-error-handling
