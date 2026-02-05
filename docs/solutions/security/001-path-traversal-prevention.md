---
title: "Path Traversal Prevention in File Operations"
category: security
tags: [path-traversal, file-system, validation, zod, node]
module: server/layouts
symptom: "User-supplied IDs used directly in file paths"
root_cause: "No validation on layout ID before constructing file path"
severity: critical
date_resolved: 2026-02-05
---

# Path Traversal Prevention in File Operations

## Problem

The `layoutPath()` function concatenated user-supplied IDs directly into file paths without sanitization:

```typescript
// VULNERABLE
function layoutPath(id: string): string {
  return join(DATA_DIR, `${id}.json`);
}
```

**Attack vectors:**
- `GET /api/layouts/../../../etc/passwd` - read arbitrary files
- `socket.emit('saveLayout', { id: '../../../package', ... })` - write arbitrary files

## Solution

Validate IDs with a strict allowlist pattern before use:

```typescript
// validation.ts
export const LayoutIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, "Layout ID must be alphanumeric with hyphens/underscores only");

// layouts.ts
function layoutPath(id: string): string {
  const safeId = validateLayoutId(id); // Throws ZodError if invalid
  return join(DATA_DIR, `${safeId}.json`);
}
```

## Key Insight

Always validate user input at the boundary before it reaches file system operations. Use allowlist patterns (what IS allowed) rather than blocklist patterns (what is NOT allowed).

## References

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- Original todo: 001-p1-path-traversal-vulnerability
