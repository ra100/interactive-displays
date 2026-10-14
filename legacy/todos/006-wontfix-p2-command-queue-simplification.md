---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, simplification, yagni, video]
dependencies: ["003"]
---

# P2: Consider Simplifying Video Command Queue

## Problem Statement

The command queue pattern in VideoElement (40+ lines) may be over-engineered for the actual use case. Video commands like `play()`, `pause()`, `seek()` don't truly need sequential processing - browsers handle these gracefully.

**However:** The race condition review found real issues with the current implementation that need fixing regardless (see todo-003). This simplification should be considered after those fixes.

## Findings

**Location:** `/packages/app/src/components/VideoElement.tsx`, lines 23-109

**Current approach:** Command queue with refs, async processing, sequential execution (193 total lines)

**Simplicity review assessment:**
- The only async operation is `play()`, browsers handle repeated play/pause gracefully
- In practice, commands won't arrive faster than they can be processed
- Adds 40+ lines of complexity for a theoretical race condition

**Counter-argument (performance review):**
- The pattern does prevent potential issues with rapid seek operations
- It's a valid architectural pattern even if not strictly necessary

## Proposed Solutions

### Option A: Keep Queue, Fix Issues (Recommended)

**Pros:** Conservative, preserves protection against edge cases
**Cons:** More complex than needed
**Effort:** Small (fix issues from todo-003)
**Risk:** Low

### Option B: Replace with Direct Execution

**Pros:** Simpler, ~43 fewer lines
**Cons:** May have edge cases with rapid commands
**Effort:** Medium
**Risk:** Medium

```typescript
// Simplified approach
const executeCommand = useCallback((data: VideoCommand) => {
  const video = videoRef.current;
  if (!video || data.elementId !== id) return;

  switch (data.command) {
    case "play":
      video.play().catch(console.error);
      break;
    case "pause":
      video.pause();
      break;
    case "seek":
      video.currentTime = data.time ?? 0;
      break;
    case "load":
      video.src = data.src ?? "";
      video.load();
      break;
  }
}, [id]);
```

## Recommended Action

Option A - Keep the queue pattern but fix the lifecycle issues identified in todo-003. Reassess simplification after real-world usage.

## Acceptance Criteria

- [ ] Fix lifecycle issues first (todo-003)
- [ ] Document the queue pattern with comments
- [ ] Consider simplification in future iteration

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from simplicity review | Balance simplicity with robustness |
