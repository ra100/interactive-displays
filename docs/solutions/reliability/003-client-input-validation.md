---
title: "Client-Side Input Validation and Error Handling"
category: reliability
tags: [validation, input, nan, error-handling, socket, client]
module: app
symptom: "Invalid values sent to server, silent connection failures"
root_cause: "Missing validation at UI boundaries, no error event handlers"
severity: medium
date_resolved: 2026-02-05
---

# Client-Side Input Validation and Error Handling

## Problem

### 1. Number inputs sending NaN

```typescript
// BAD - parseInt("", 10) returns NaN
<input
  type="number"
  value={element.col}
  onChange={(e) =>
    handleNumberChange("col", parseInt(e.target.value, 10))
  }
/>

// User clears input → NaN sent to server → corrupted data
```

### 2. Socket connection errors unhandled

```typescript
// BAD - no feedback when connection fails
const socket = io(SERVER_URL);

socket.on("connect", () => setIsConnected(true));
socket.on("disconnect", () => setIsConnected(false));
// Missing: connect_error handler
```

## Solution

### 1. Validate before propagating changes

```typescript
const handleNumberChange = useCallback(
  (field: "col" | "row" | "colSpan" | "rowSpan", value: number) => {
    // Guard against NaN from empty/invalid input
    if (selectedElementId && !Number.isNaN(value)) {
      updateElement(selectedElementId, { [field]: value });
    }
  },
  [selectedElementId, updateElement]
);
```

### Alternative: Validate at input level

```typescript
onChange={(e) => {
  const value = parseInt(e.target.value, 10);
  if (!Number.isNaN(value)) {
    handleNumberChange("col", value);
  }
}}
```

### 2. Handle socket connection errors

```typescript
useEffect(() => {
  const socket = io(SERVER_URL);

  socket.on("connect", () => {
    setIsConnected(true);
  });

  socket.on("disconnect", () => {
    setIsConnected(false);
  });

  // Handle connection errors
  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
    // Optionally: setConnectionError(error.message)
  });

  socketRef.current = socket;
  return () => socket.close();
}, []);
```

## Validation Boundaries

| Boundary | What to Validate | Example |
|----------|-----------------|---------|
| User input | Type coercion results | `Number.isNaN()`, empty strings |
| API calls | Response shape | Zod schemas |
| Socket events | Incoming data | Type guards |
| URL params | Expected format | Regex, parseInt checks |

### Client-side validation is NOT a replacement for server-side

```
User Input → Client Validation → Server Validation → Database
              (UX/immediate)     (Security/truth)
```

Client validation improves UX. Server validation enforces rules.

## Key Insight

- **Validate at boundaries** - Where data enters your code
- **Fail gracefully** - Invalid input = no action, not crash
- **Log connection errors** - Silent failures are hard to debug
- **Use type guards** - `Number.isNaN()`, `typeof`, Zod

## References

- [Number.isNaN() vs isNaN()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN)
- [Socket.io error handling](https://socket.io/docs/v4/client-socket-instance/#connect_error)
- Original todos: 005-pending-p2-add-nan-validation, 002-pending-p1-add-socket-error-handler
