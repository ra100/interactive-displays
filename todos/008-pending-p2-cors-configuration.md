---
status: pending
priority: p2
issue_id: "008"
tags: [security, code-review, server]
dependencies: []
---

# Overly Permissive CORS Configuration

## Problem Statement

Both Fastify and Socket.io are configured with `origin: "*"`, allowing any website to make requests to the API.

**Why it matters:** Any malicious site can connect and trigger state changes on all displays.

## Findings

**Location:** `packages/server/src/index.ts:19, 24`

```typescript
await fastify.register(cors, { origin: true });
const io = new Server(fastify.server, { cors: { origin: "*" } });
```

## Proposed Solutions

### Option A: Whitelist Origins (Recommended)

```typescript
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? ['https://your-domain.com']
  : ['http://localhost:5176', 'http://127.0.0.1:5176'];

await fastify.register(cors, { origin: ALLOWED_ORIGINS });
const io = new Server(fastify.server, { cors: { origin: ALLOWED_ORIGINS } });
```

**Effort:** Small (10 min)
**Risk:** Low

**Note:** For local LAN use (video production), `origin: true` may be acceptable. Document the security tradeoff.

## Acceptance Criteria

- [ ] CORS origins configurable via environment
- [ ] Production has restricted origins
- [ ] Development allows localhost
- [ ] Security tradeoff documented

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during security review |
