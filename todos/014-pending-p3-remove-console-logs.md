---
status: pending
priority: p3
issue_id: "014"
tags: [cleanup, code-review]
dependencies: []
---

# Remove Console.log Statements

## Problem Statement

Production code has console.log scattered throughout. Should use proper logger.

## Findings

**Server:** `packages/server/src/index.ts:40,48,61,76,83`
**Client:** `packages/app/src/context/DisplayContext.tsx:62,67,72,77`

## Proposed Solutions

### Option A: Remove All (MVP)
Remove console.log statements for cleaner output.

### Option B: Use Logger (Better)
- Server: Use Fastify's built-in logger `fastify.log.info(...)`
- Client: Use conditional debug utility

**Effort:** Small (10 min)

## Acceptance Criteria

- [ ] No console.log in production code
- [ ] Server uses Fastify logger (optional)
- [ ] Client uses debug mode check (optional)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-05 | Created | Found during TypeScript review |
