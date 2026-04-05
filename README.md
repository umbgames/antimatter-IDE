# Antimatter

Antimatter is a local-first, no-signup, BYOK agentic IDE for developers who want control over their workspace, model providers, and execution surface.

This repository ships a production-grade starter for a desktop-first IDE built with:

- **Tauri + Rust** for the desktop shell and system-facing commands
- **React + TypeScript + Vite** for the frontend
- **Monaco Editor** for code editing
- **Zustand** for app state
- A shared, extensible architecture for **providers**, **agents**, **tools**, and future browser targets

## Product principles

- **Local-first**: your workspace stays on your machine
- **No signup**: no mandatory account flow
- **BYOK**: bring your own provider credentials
- **No cloud lock-in**: supports hosted APIs, Groq, local model endpoints, and OpenAI-compatible endpoints
- **Safe-by-default agent UX**: previews, logs, and approvals before risky actions
- **Open-source-friendly**: modular packages, low ceremony, clear boundaries

## Supported provider architecture

Antimatter ships provider abstractions for:

- OpenAI
- Anthropic
- Gemini
- Groq
- Local model endpoints
- Custom OpenAI-compatible endpoints

Antimatter **does not include models**. Users connect their own providers, self-hosted endpoints, or locally running model servers if they already have them. Model quality, latency, and cost depend on the user’s chosen provider, endpoint, hardware, and configuration.

## Repository layout

```text
/antimatter
  /apps
    /desktop        # Tauri app, React frontend, Rust backend
  /packages
    /agents         # Agent runtime contracts and orchestration helpers
    /providers      # Provider abstractions and registry
    /shared         # Shared domain types and constants
    /tools          # Tool abstractions and tool descriptors
    /ui             # Reusable UI-oriented utilities and tokens
```

## Quick start

### Prerequisites

- Node.js 20+
- Rust stable
- Tauri prerequisites for your OS

### Install

```bash
npm install
```

### Run the desktop app

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Current capabilities

- Welcome and onboarding surface
- Recent projects list
- File explorer and Monaco editor shell
- Menu / toolbar / status bar scaffold
- Command palette
- Dockable agent panel with resizable panes
- Provider configuration UI with connection tests
- Theme switching (dark and light)
- Local-first settings persistence through the desktop backend
- Agent run pipeline with tool planning contracts
- Diff preview and approval gate for file writes
- Guarded terminal execution stub

## What is intentionally stubbed in v0.1

A few advanced flows are wired cleanly but kept conservative for the starter:

- Full streaming chat for every provider
- Rich workspace indexing
- Real terminal sandbox policies
- Multi-editor-group orchestration
- Marketplace / plugin loading
- Browser runtime target

Those are left in a contributor-friendly state so they can be extended without reworking the core architecture.

## Security notes

- API keys are **never hardcoded**
- Provider secrets should be stored with the OS credential store when available
- Dangerous agent actions must ask for approval before execution
- File modifications are shown in a diff before apply
- Telemetry is off by default and not required

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
