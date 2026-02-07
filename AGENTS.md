# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LCARS Interactive Display System - A WebSocket-based client-server system for creating and displaying Star Trek-style sci-fi interfaces for video production. Enables 6-15 simultaneous browser displays with real-time coordination.

## Architecture

```
lcars/
├── packages/
│   ├── server/          # Fastify + Socket.io (Node.js 24 LTS)
│   ├── app/             # React 19 + Vite (display + builder modes)
│   └── shared/          # Shared types and utilities
├── data/layouts/        # JSON layout files (gitignored)
├── tests/               # E2E tests (Playwright)
└── docs/
    ├── plans/           # Implementation plans
    ├── solutions/       # Lessons learned
    └── deviations/      # Plan deviation records
```

**Tech Stack:** pnpm monorepo, TypeScript strict mode, React 19, Fastify, Socket.io, @dnd-kit

## Development Workflow

### TDD/BDD Pattern (Mandatory)

**All new code must have tests written FIRST or alongside the implementation.**

1. **Write test first** - Define expected behavior before implementation
2. **Implement minimal code** - Just enough to pass the test
3. **Run tests frequently** - After every meaningful change
4. **Refactor** - Clean up while tests stay green

### Testing Strategy

#### Unit Tests (Vitest)
- **Location:** Co-located with source files (`*.test.ts` / `*.test.tsx`)
- **Scope:** Individual functions, utilities, React components in isolation
- **Mocking:** Mock external dependencies (Socket.io, file system)

```
packages/app/src/
├── utils/
│   ├── getStateClass.ts
│   └── getStateClass.test.ts    # Unit test next to source
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx          # Component unit test
```

#### Integration Tests (Vitest)
- **Location:** Co-located with source files (`*.integration.test.ts`)
- **Scope:** Multiple units working together, context providers, hooks
- **Example:** Testing BuilderContext with mock socket

```
packages/app/src/
├── context/
│   ├── DisplayContext.tsx
│   └── DisplayContext.integration.test.tsx
```

#### E2E Tests (Playwright)
- **Location:** `/tests/e2e/`
- **Scope:** Full user flows across browser, server, and WebSocket
- **Example:** User creates layout, saves, opens on another display

```
tests/
├── e2e/
│   ├── display.spec.ts          # Display client tests
│   ├── builder.spec.ts          # Builder flow tests
│   ├── state-sync.spec.ts       # Multi-client sync tests
│   └── acceptance.spec.ts       # Acceptance criteria
```

### Test File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Unit | `*.test.ts` | `getStateClass.test.ts` |
| Integration | `*.integration.test.ts` | `DisplayContext.integration.test.ts` |
| E2E | `*.spec.ts` | `builder.spec.ts` |

### After Each Functional Piece

1. Write unit tests for new utilities/components
2. Write integration tests for context/hooks
3. Run the test suite: `pnpm test`
4. Run code review (use `/workflows:review` or review agents)
5. Apply code simplification - remove unnecessary complexity
6. Commit only when tests pass

### Commit Convention

Use **Conventional Commits** with **gitmoji** prefixes:

```
🎉 feat: add elbow component with TL/TR/BL/BR variants
🐛 fix: correct WebSocket reconnection handling
♻️ refactor: simplify state broadcast logic
✅ test: add Playwright tests for button touch feedback
📝 docs: update operator quick-start guide
🔧 chore: configure pnpm workspace
```

**Rules:**
- Small commits with small working parts
- Each commit should be a complete, working unit
- Never commit failing tests

### Sprint Completion

At the end of each phase/sprint, provide:

1. **Manual testing guide** - Step-by-step instructions for human verification
2. **What to test** - Key user flows and edge cases
3. **How to provide feedback** - Where to report issues or suggestions
4. **Known limitations** - What's not yet implemented

## Plan Deviations

When deviating from the plan in `docs/plans/`, create a deviation record:

**File:** `docs/deviations/YYYY-MM-DD-<topic>.md`

**Template:**
```markdown
# Deviation: <Brief Description>

## Date
YYYY-MM-DD

## Original Plan
[Quote or reference the original plan section]

## What Changed
[Describe the actual implementation]

## Justification
[Explain why the deviation was necessary]

## Impact
[Note any downstream effects on other planned work]
```

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev              # Run all packages in dev mode

# Testing
pnpm test             # Run all tests (unit + integration)
pnpm test:unit        # Unit tests only (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:watch       # Watch mode for unit tests

# Code Quality
pnpm lint             # Oxlint
pnpm typecheck        # TypeScript strict check

# Build
pnpm build            # Production build
```

## Key Conventions

- **No `any` types** - TypeScript strict mode enforced
- **Fat arrow functions** - Use `const fn = () => {}` instead of `function fn() {}`
- **Tests required** - All new code needs unit/integration tests
- **React Context** for state (not Zustand in MVP)
- **5 LCARS elements only:** Elbow, Bar, Frame, Button, Text
- **Global state:** `'normal' | 'alert' | 'active' | 'damaged'`
- **JSON files** for layout persistence (no database)

## Reference Documents

- **Plan:** `docs/plans/2026-02-04-feat-lcars-interactive-display-system-plan.md`
- **Acceptance Testing:** `docs/ACCEPTANCE-TESTING.md`
- **Design assets:** `design/*.jpg`, `design/*.webp`
