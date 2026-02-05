# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LCARS Interactive Display System - A WebSocket-based client-server system for creating and displaying Star Trek-style sci-fi interfaces for video production. Enables 6-15 simultaneous browser displays with real-time coordination.

## Architecture

```
lcars/
├── packages/
│   ├── server/          # Fastify + Socket.io (Node.js 24 LTS)
│   └── app/             # React 19 + Vite (display + builder modes)
├── data/layouts/        # JSON layout files (gitignored)
└── docs/
    ├── plans/           # Implementation plans
    └── deviations/      # Plan deviation records
```

**Tech Stack:** pnpm monorepo, TypeScript strict mode, React 19, Fastify, Socket.io, @dnd-kit

## Development Workflow

### TDD/BDD Pattern (Mandatory)

1. **Write test first** - Define expected behavior before implementation
2. **Implement minimal code** - Just enough to pass the test
3. **Run tests frequently** - After every meaningful change
4. **Refactor** - Clean up while tests stay green

### UI Testing

Use **Playwright** for all UI/integration tests:
- Test display client rendering
- Test builder interactions (drag-drop, property editing)
- Test WebSocket state synchronization across clients

### After Each Functional Piece

1. Run the test suite
2. Run code review (use `/workflows:review` or review agents)
3. Apply code simplification - remove unnecessary complexity
4. Commit only when tests pass

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
pnpm dev:server       # Run server only
pnpm dev:app          # Run app only

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:e2e         # Playwright E2E tests
pnpm test:watch       # Watch mode

# Code Quality
pnpm lint             # ESLint
pnpm typecheck        # TypeScript strict check

# Build
pnpm build            # Production build
```

## Key Conventions

- **No `any` types** - TypeScript strict mode enforced
- **React Context** for state (not Zustand in MVP)
- **5 LCARS elements only:** Elbow, Bar, Frame, Button, Text
- **Global state:** `'normal' | 'redAlert' | 'active' | 'damaged'`
- **JSON files** for layout persistence (no database)

## Reference Documents

- **Plan:** `docs/plans/2026-02-04-feat-lcars-interactive-display-system-plan.md`
- **Design assets:** `design/*.jpg`, `design/*.webp`
