---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, socket-io, video]
dependencies: []
---

# P1: Add Input Validation for videoCommand Socket Event

## Problem Statement

The `videoCommand` socket event handler accepts arbitrary data from clients and broadcasts it to all connected displays without any validation. This is a **critical security vulnerability** that could enable:

- XSS attacks via malicious `src` URLs (e.g., `javascript:alert()`)
- DoS attacks via malformed commands
- Arbitrary payload injection to all clients

Other socket handlers (`identify`, `stateChange`, `getLayout`) properly validate input using Zod schemas, but `videoCommand` and `videoState` do not.

## Findings

**Location:** `/packages/server/src/index.ts`, lines 141-156

```typescript
// Video control - operator sends command, broadcast to all displays
socket.on("videoCommand", (command: VideoCommand) => {
  fastify.log.info(
    `Video command: ${command.command} for element ${command.elementId}`
  );
  // Broadcast to all clients (including sender for consistency)
  io.emit("videoCommand", command);  // NO VALIDATION!
});
```

**Evidence from Security Review:**
- The `videoCommand` handler trusts client input completely
- Malicious URLs can be injected via the `load` command
- No validation that `elementId` is a valid identifier
- No validation that `command` is one of the allowed types

## Proposed Solutions

### Option A: Add Zod Validation Schema (Recommended)

**Pros:** Consistent with existing patterns, comprehensive validation
**Cons:** Requires new schema definition
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
// In validation.ts
export const VideoCommandTypeSchema = z.enum(["play", "pause", "seek", "load"]);

export const VideoUrlSchema = z.string()
  .max(2048)
  .refine((url) => {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      return ["http:", "https:", "blob:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, "Video URL must use http, https, or blob protocol");

export const VideoCommandSchema = z.object({
  elementId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  command: VideoCommandTypeSchema,
  time: z.number().min(0).optional(),
  src: VideoUrlSchema.optional(),
});

// In index.ts
socket.on("videoCommand", (command: unknown) => {
  try {
    const validCommand = VideoCommandSchema.parse(command);
    io.emit("videoCommand", validCommand);
  } catch (error) {
    socket.emit("error", "INVALID_VIDEO_COMMAND", "Invalid video command");
  }
});
```

### Option B: Inline Validation

**Pros:** Quick to implement
**Cons:** Doesn't follow existing patterns, less maintainable
**Effort:** Small (30 min)
**Risk:** Medium

## Recommended Action

Implement Option A - Add Zod validation schema following existing patterns.

## Technical Details

**Affected files:**
- `/packages/server/src/validation.ts` - Add new schemas
- `/packages/server/src/index.ts` - Use validation in handler

**Acceptance Criteria:**
- [ ] VideoCommandSchema validates all fields
- [ ] Invalid commands rejected with error event
- [ ] URL protocol whitelist (http, https, blob only)
- [ ] Element ID format validation (alphanumeric with dash/underscore)
- [ ] Tests for validation edge cases

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from security review | Socket events need consistent validation |

## Resources

- Security review findings
- Existing validation patterns in `/packages/server/src/validation.ts`
