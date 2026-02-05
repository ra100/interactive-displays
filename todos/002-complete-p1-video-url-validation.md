---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, xss, video]
dependencies: ["001"]
---

# P1: Add URL Validation for Video Sources

## Problem Statement

Video URLs are accepted from user input without validation and used directly in `<video src>` attributes. This creates XSS attack vectors through dangerous URL protocols like `javascript:` and `data:`.

## Findings

**Locations:**
- `/packages/app/src/builder/PropertyPanel.tsx` - User input accepted
- `/packages/app/src/components/VideoElement.tsx` - URL used directly

```typescript
// PropertyPanel.tsx - No validation
const handleSrcChange = useCallback(
  (src: string) => {
    if (selectedElementId) {
      updateElement(selectedElementId, { src });  // Accepts any string
    }
  },
  [selectedElementId, updateElement]
);

// VideoElement.tsx - Direct use
<video ref={videoRef} src={src} ... />  // XSS if src is "javascript:..."
```

**Attack vectors:**
- `javascript:alert(document.cookie)` - Script execution
- `data:text/html,<script>...</script>` - Embedded script

## Proposed Solutions

### Option A: Client + Server Validation (Recommended)

**Pros:** Defense in depth
**Cons:** More code
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
// Shared utility
function isValidVideoUrl(url: string): boolean {
  if (!url) return true;  // Empty is valid (shows placeholder)
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "blob:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// PropertyPanel.tsx
const handleSrcChange = useCallback(
  (src: string) => {
    if (selectedElementId && isValidVideoUrl(src)) {
      updateElement(selectedElementId, { src });
    }
  },
  [selectedElementId, updateElement]
);
```

### Option B: Server-Side Only

**Pros:** Single validation point
**Cons:** Bad UX (save fails silently)
**Effort:** Small
**Risk:** Medium

## Recommended Action

Option A - Validate on both client (for UX) and server (for security).

## Acceptance Criteria

- [ ] Client-side validation with user feedback
- [ ] Server-side validation in save handler
- [ ] Reject `javascript:`, `data:`, `file:` protocols
- [ ] Allow `http:`, `https:`, `blob:` protocols
- [ ] Tests for malicious URL rejection

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from security review | URL validation critical for XSS prevention |
