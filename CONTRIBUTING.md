# Contributing to Antimatter

Thanks for contributing.

## Goals for contributions

Keep changes:

- local-first
- provider-agnostic
- modular
- easy to review
- safe by default

## Development principles

### 1. Respect package boundaries

- `packages/shared` holds domain types and constants
- `packages/providers` owns provider contracts and provider-specific clients
- `packages/agents` owns orchestration contracts and workflows
- `packages/tools` owns tool descriptors and execution interfaces
- `apps/desktop` owns product UI, Tauri wiring, and desktop-specific persistence

### 2. Prefer extension over rewrites

Add new providers, tools, and layouts through registries and contracts instead of special-casing them in UI components.

### 3. Keep the desktop app safe by default

Any action that can modify files, run shell commands, or change workspace state should be previewable and approval-aware.

### 4. Keep comments rare and useful

Document intent, constraints, or tricky invariants. Avoid narrating obvious code.

## Setup

```bash
npm install
npm run dev
```

## Pull request checklist

- The app still builds and launches
- New modules are typed and named consistently
- User-facing copy is clear about BYOK and local-first behavior
- Security-sensitive changes include a rationale
- New provider or tool integrations preserve existing interfaces

## Areas that are good first contributions

- Provider streaming implementations
- Better workspace search and indexing
- Safer terminal execution policy controls
- Browser-target transport layer
- Additional command palette actions
- More IDE panels and richer editor workflows
