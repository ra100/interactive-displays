---
title: "Preventing Race Conditions in Async React Effects"
category: reliability
tags: [react, useEffect, async, race-conditions, unmount, cleanup]
module: app
symptom: "Errors after component unmount, stale state updates, memory leaks"
root_cause: "Async operations completing after component unmount without guards"
severity: high
date_resolved: 2026-02-05
---

# Preventing Race Conditions in Async React Effects

## Problem

When components with async operations unmount, pending operations can:
1. Complete and try to update unmounted component state
2. Cause "Can't perform state update on unmounted component" warnings
3. Create memory leaks from uncleaned subscriptions
4. Execute stale callbacks with outdated closures

```typescript
// BAD - No protection against unmount race conditions
useEffect(() => {
  async function processQueue() {
    while (queue.length > 0) {
      const cmd = queue.shift();
      await video.play(); // What if component unmounts here?
      // Code continues with stale refs
    }
  }

  socket.on("command", handleCommand);

  return () => {
    socket.off("command", handleCommand);
    // Queue still processing!
  };
}, [socket]);
```

## Solution

### 1. Use a disposed ref to guard async operations

```typescript
const disposedRef = useRef(false);

const processQueue = useCallback(async () => {
  // Guard at start
  if (disposedRef.current) return;

  processingRef.current = true;
  const cmd = commandQueueRef.current.shift()!;

  try {
    await video.play();
    // Check after every async operation
    if (disposedRef.current) return;
  } catch (err) {
    // Suppress errors for disposed components
    if (!disposedRef.current) {
      console.error("Command failed:", err);
    }
  }

  // Check before continuing
  if (disposedRef.current) return;
  processingRef.current = false;

  // Safe to continue processing
  if (commandQueueRef.current.length > 0) {
    queueMicrotask(() => processQueue());
  }
}, []);
```

### 2. Clear queues and set disposed flag on unmount

```typescript
useEffect(() => {
  const unsubscribe = subscribeToCommands(handleCommand);

  return () => {
    disposedRef.current = true;           // Mark as disposed FIRST
    commandQueueRef.current = [];         // Clear pending work
    unsubscribe();                         // Then cleanup subscriptions
  };
}, [subscribeToCommands]);
```

### 3. Use queueMicrotask to break recursive call stacks

```typescript
// BAD - Can cause stack overflow with rapid commands
if (queue.length > 0) {
  processQueue(); // Direct recursion
}

// GOOD - Breaks stack, allows disposal check
if (queue.length > 0) {
  queueMicrotask(() => processQueue());
}
```

### 4. Clear work when preconditions become invalid

```typescript
// Clear queue when src becomes empty (video can't process commands)
useEffect(() => {
  if (!src) {
    commandQueueRef.current = [];
  }
}, [src]);
```

## Key Insight

- Set `disposedRef = true` as the FIRST action in cleanup
- Check `disposedRef` after EVERY async operation
- Clear any pending work queues in cleanup
- Suppress errors from disposed components
- Use `queueMicrotask` to break recursive patterns

## Full Pattern

```typescript
function AsyncComponent() {
  const disposedRef = useRef(false);
  const queueRef = useRef<Command[]>([]);
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (disposedRef.current || processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;

    try {
      const cmd = queueRef.current.shift()!;
      await executeCommand(cmd);
      if (disposedRef.current) return;
    } catch (err) {
      if (!disposedRef.current) console.error(err);
    }

    if (disposedRef.current) return;
    processingRef.current = false;
    if (queueRef.current.length > 0) queueMicrotask(processQueue);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe((cmd) => {
      queueRef.current.push(cmd);
      processQueue();
    });

    return () => {
      disposedRef.current = true;
      queueRef.current = [];
      unsubscribe();
    };
  }, [subscribe, processQueue]);
}
```

## References

- Original todo: 003-p1-video-unmount-race-condition
