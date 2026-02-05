---
status: pending
priority: p1
issue_id: "002"
tags: [security, code-review, server, socket-io]
dependencies: []
---

# Missing Input Validation on Socket.io Events

## Problem Statement

All Socket.io event handlers accept user input without any runtime validation. TypeScript types provide compile-time hints but offer zero runtime protection. Malicious clients can send arbitrary data causing crashes, data corruption, or security exploits.

**Why it matters:** Any connected client can send malformed data, crash the server, or inject malicious content.

## Findings

**Location:** `packages/server/src/index.ts:46-79`

```typescript
// No validation - accepts ANY string
socket.on("identify", async (screenId) => {
  connectedScreens.set(socket.id, screenId);
});

// No validation - accepts ANY value
socket.on("stateChange", (newState) => {
  globalState = newState;  // Could be object, array, anything
});

// No validation - accepts ANY object
socket.on("saveLayout", async (layout) => {
  const saved = await saveLayout(layout);  // Writes to filesystem
});
```

**Attack vectors:**
- State injection: `socket.emit('stateChange', '<script>alert(1)</script>')`
- DoS via large payloads: `socket.emit('saveLayout', { elements: new Array(1000000) })`
- Prototype pollution: `socket.emit('saveLayout', { __proto__: { polluted: true } })`

## Proposed Solutions

### Option A: Zod Validation (Recommended)
Add runtime schema validation using Zod.

```typescript
import { z } from 'zod';

const GlobalStateSchema = z.enum(['normal', 'alert', 'active', 'damaged']);

const LayoutElementSchema = z.object({
  id: z.string().max(100),
  type: z.enum(['elbow', 'bar', 'frame', 'button', 'text']),
  col: z.number().int().min(0).max(11),
  row: z.number().int().min(0),
  colSpan: z.number().int().min(1).max(12),
  rowSpan: z.number().int().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  direction: z.enum(['TL', 'TR', 'BL', 'BR']).optional(),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  label: z.string().max(200).optional(),
});

const LayoutSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(100),
  name: z.string().max(200),
  elements: z.array(LayoutElementSchema).max(500),
});

socket.on("stateChange", (newState) => {
  const result = GlobalStateSchema.safeParse(newState);
  if (!result.success) return;
  globalState = result.data;
  io.emit("state", globalState);
});
```

**Pros:** Type-safe, reusable schemas, great error messages
**Cons:** Adds dependency (~50KB)
**Effort:** Medium (1-2 hours)
**Risk:** Low

### Option B: Manual Validation
Hand-write validation functions.

**Pros:** No new dependency
**Cons:** More code, easier to miss edge cases
**Effort:** Medium (1-2 hours)
**Risk:** Medium - easy to have gaps

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `packages/server/src/index.ts` - all socket event handlers
- `packages/server/package.json` - add zod dependency

**Events needing validation:**
- `identify(screenId: string)` - validate string, max length
- `stateChange(state)` - validate enum
- `saveLayout(layout)` - validate full schema
- `getLayout(layoutId)` - validate string format

## Acceptance Criteria

- [ ] All Socket.io events validate input before processing
- [ ] Invalid input returns error (via acknowledgment or error event)
- [ ] Valid requests still work
- [ ] Validation schemas exported for client-side reuse
- [ ] DoS protection: max payload sizes enforced

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during code review |

## Resources

- [Zod Documentation](https://zod.dev/)
- Security audit finding P1-002
