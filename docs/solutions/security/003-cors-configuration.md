---
title: "Environment-Based CORS Configuration"
category: security
tags: [cors, fastify, socket-io, environment]
module: server
symptom: "CORS configured with origin: '*' allowing any website"
root_cause: "Permissive defaults for development leaked to production config"
severity: medium
date_resolved: 2026-02-05
---

# Environment-Based CORS Configuration

## Problem

Both Fastify and Socket.io were configured with `origin: "*"`:

```typescript
// INSECURE for production
await fastify.register(cors, { origin: true });
const io = new Server(fastify.server, { cors: { origin: "*" } });
```

Any malicious website could connect and trigger state changes on all displays.

## Solution

Configure CORS based on environment:

```typescript
const ALLOWED_ORIGINS =
  process.env["NODE_ENV"] === "production"
    ? (process.env["ALLOWED_ORIGINS"]?.split(",") ?? [])
    : true; // Allow all in development

await fastify.register(cors, { origin: ALLOWED_ORIGINS });
const io = new Server(fastify.server, { cors: { origin: ALLOWED_ORIGINS } });
```

## Key Insight

For local LAN applications (like video production displays), permissive CORS may be acceptable. Document the security tradeoff explicitly in comments. For internet-facing deployments, always restrict origins.

## References

- Original todo: 008-p2-cors-configuration
