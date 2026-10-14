---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, typescript, validation, schema]
dependencies: []
---

# P2: Update Validation Schema for Video Element Type

## Problem Statement

The Zod validation schema in `validation.ts` is out of sync with the shared types. It's missing:
- `"video"` in ElementTypeSchema
- Video-specific fields (`src`, `autoplay`, `loop`, `muted`, `fit`)
- Elbow arm widths (`verticalWidth`, `horizontalWidth`)
- Button corners (`leftCorner`, `rightCorner`)

This will cause layouts with these new features to fail validation on save.

## Findings

**Location:** `/packages/server/src/validation.ts`

```typescript
// Missing "video"
export const ElementTypeSchema = z.enum(["elbow", "bar", "frame", "button", "text"]);

// Missing new fields
export const LayoutElementSchema = z.object({
  // ... existing fields ...
  // MISSING: src, autoplay, loop, muted, fit
  // MISSING: verticalWidth, horizontalWidth
  // MISSING: leftCorner, rightCorner
});
```

## Proposed Solutions

### Option A: Add All Missing Fields

**Effort:** Small (30 min)
**Risk:** Low

```typescript
export const ElementTypeSchema = z.enum([
  "elbow", "bar", "frame", "button", "text", "video"
]);

export const VideoFitSchema = z.enum(["contain", "cover", "fill"]);
export const CornerStyleSchema = z.enum(["round", "square"]);

export const LayoutElementSchema = z.object({
  // ... existing ...
  verticalWidth: z.number().int().min(1).max(4).optional(),
  horizontalWidth: z.number().int().min(1).max(4).optional(),
  leftCorner: CornerStyleSchema.optional(),
  rightCorner: CornerStyleSchema.optional(),
  src: VideoUrlSchema.optional(),  // From todo-001
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  fit: VideoFitSchema.optional(),
});
```

## Acceptance Criteria

- [ ] ElementTypeSchema includes "video"
- [ ] All video fields validated
- [ ] Elbow width fields validated (1-4 range)
- [ ] Button corner fields validated
- [ ] Tests for new validation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from TypeScript review | Keep validation schema in sync with types |
