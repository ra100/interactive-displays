# Solutions & Learnings

This directory contains documented solutions to problems encountered during development. These files serve as institutional knowledge for both human developers and AI coding agents.

## Purpose

1. **Prevent repeated mistakes** - AI agents can search these files before implementing features
2. **Preserve context** - Explains *why* decisions were made, not just *what* was done
3. **Speed up debugging** - Search by symptoms to find relevant past solutions

## Structure

```
docs/solutions/
├── README.md           # This file
├── security/           # Security vulnerabilities and fixes
├── performance/        # Performance issues and optimizations
├── architecture/       # Structural decisions and patterns
└── reliability/        # Error handling, resilience, stability
```

## File Format

Each solution file uses YAML frontmatter for AI-searchable metadata:

```yaml
---
title: "Brief descriptive title"
category: security|performance|architecture|reliability
tags: [searchable, keywords, for, filtering]
module: which part of codebase this affects
symptom: "What you observe when this problem occurs"
root_cause: "Why the problem happened"
severity: critical|high|medium|low
date_resolved: YYYY-MM-DD
---
```

## How AI Agents Should Use This

### Before implementing a feature:
```
Search docs/solutions/ for relevant tags or symptoms
```

### When debugging:
```
grep -r "symptom.*<observed behavior>" docs/solutions/
```

### After solving a problem:
Convert the fix into a learning (see below)

## Converting Todos to Learnings

When issues are found and fixed, convert them from todos to learnings:

### 1. Identify the category
- **security/** - Vulnerabilities, input validation, auth issues
- **performance/** - Slow operations, memory leaks, unnecessary renders
- **architecture/** - Code organization, patterns, package structure
- **reliability/** - Error handling, edge cases, resilience

### 2. Write the frontmatter
Include searchable metadata:
- `tags` - Technologies, patterns, error types involved
- `symptom` - What someone would observe/search for
- `root_cause` - The underlying issue (helps prevent similar bugs)

### 3. Document the problem and solution
Structure:
1. **Problem** - Code snippet showing the issue
2. **Solution** - Code snippet showing the fix
3. **Key Insight** - The generalizable lesson
4. **References** - Links, original todo ID

### 4. Consolidate related issues
Multiple small fixes for the same concept → one comprehensive learning
(e.g., 8 YAGNI cleanup items → one "YAGNI Cleanup Patterns" doc)

## Example Workflow

```bash
# After fixing issue in todos/
# 1. Create learning file
cat > docs/solutions/security/004-new-issue.md << 'EOF'
---
title: "..."
category: security
tags: [...]
...
---
# Title
## Problem
## Solution
## Key Insight
EOF

# 2. Remove the todo (it's now preserved as a learning)
rm todos/XXX-complete-*.md

# 3. Commit both changes
git add docs/solutions/ todos/
git commit -m "📚 Convert todo XXX to learning"
```

## Index of Solutions

### Security
- [001-path-traversal-prevention](security/001-path-traversal-prevention.md) - Validating file paths
- [002-socket-input-validation](security/002-socket-input-validation.md) - Runtime validation with Zod
- [003-cors-configuration](security/003-cors-configuration.md) - Environment-based CORS

### Performance
- [001-react-context-memoization](performance/001-react-context-memoization.md) - useMemo, useRef, React.memo
- [002-cache-frequently-accessed-data](performance/002-cache-frequently-accessed-data.md) - In-memory caching

### Architecture
- [001-shared-types-package](architecture/001-shared-types-package.md) - Monorepo type sharing
- [002-yagni-cleanup-patterns](architecture/002-yagni-cleanup-patterns.md) - Removing unused code

### Reliability
- [001-error-handling-patterns](reliability/001-error-handling-patterns.md) - File and socket error handling
