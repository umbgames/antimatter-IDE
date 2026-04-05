# Antimatter Codebundle

## File tree

```text
.editorconfig
.gitignore
CONTRIBUTING.md
LICENSE
README.md
apps/desktop/index.html
apps/desktop/package.json
apps/desktop/src/App.tsx
apps/desktop/src/components/agents/AgentPanel.tsx
apps/desktop/src/components/agents/DiffPreviewCard.tsx
apps/desktop/src/components/editor/EditorShell.tsx
apps/desktop/src/components/explorer/FileExplorer.tsx
apps/desktop/src/components/layout/StatusBar.tsx
apps/desktop/src/components/layout/TitleBar.tsx
apps/desktop/src/components/layout/Toolbar.tsx
apps/desktop/src/components/palette/CommandPalette.tsx
apps/desktop/src/components/providers/ProviderSettingsModal.tsx
apps/desktop/src/components/settings/SettingsDrawer.tsx
apps/desktop/src/components/terminal/BottomPanel.tsx
apps/desktop/src/components/welcome/WelcomeScreen.tsx
apps/desktop/src/hooks/useKeyboardShortcuts.ts
apps/desktop/src/lib/tauri.ts
apps/desktop/src/main.tsx
apps/desktop/src/store/appStore.ts
apps/desktop/src/styles/global.css
apps/desktop/src-tauri/Cargo.toml
apps/desktop/src-tauri/build.rs
apps/desktop/src-tauri/capabilities/default.json
apps/desktop/src-tauri/src/commands/mod.rs
apps/desktop/src-tauri/src/commands/provider.rs
apps/desktop/src-tauri/src/commands/settings.rs
apps/desktop/src-tauri/src/commands/workspace.rs
apps/desktop/src-tauri/src/lib.rs
apps/desktop/src-tauri/src/main.rs
apps/desktop/src-tauri/src/models.rs
apps/desktop/src-tauri/src/storage.rs
apps/desktop/src-tauri/tauri.conf.json
apps/desktop/tsconfig.json
apps/desktop/vite.config.ts
package.json
packages/agents/package.json
packages/agents/src/index.ts
packages/providers/package.json
packages/providers/src/index.ts
packages/shared/package.json
packages/shared/src/index.ts
packages/tools/package.json
packages/tools/src/index.ts
packages/ui/package.json
packages/ui/src/index.ts
tsconfig.base.json
```

FILE: .editorconfig
```text
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

FILE: .gitignore
```gitignore
node_modules
pnpm-lock.yaml
package-lock.json
yarn.lock
.DS_Store
dist
coverage
.vscode
.idea
*.log
apps/desktop/src-tauri/target
apps/desktop/src-tauri/gen
apps/desktop/src-tauri/.cargo
```

FILE: CONTRIBUTING.md
```md
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
```

FILE: LICENSE
```text
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

FILE: README.md
```md
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
- **No cloud lock-in**: supports hosted APIs, local model endpoints, and OpenAI-compatible endpoints
- **Safe-by-default agent UX**: previews, logs, and approvals before risky actions
- **Open-source-friendly**: modular packages, low ceremony, clear boundaries

## Supported provider architecture

Antimatter ships provider abstractions for:

- OpenAI
- Anthropic
- Gemini
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
```

FILE: apps/desktop/index.html
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Antimatter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

FILE: apps/desktop/package.json
```json
{
  "name": "@antimatter/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "lint": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@antimatter/agents": "0.1.0",
    "@antimatter/providers": "0.1.0",
    "@antimatter/shared": "0.1.0",
    "@antimatter/tools": "0.1.0",
    "@monaco-editor/react": "^4.6.0",
    "@tauri-apps/api": "^2.0.0",
    "clsx": "^2.1.1",
    "monaco-editor": "^0.52.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-resizable-panels": "^2.1.4",
    "zustand": "^5.0.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  }
}
```

FILE: apps/desktop/src/App.tsx
```tsx
import { useEffect, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { APP_NAME } from '@antimatter/shared';
import { runSingleAgent } from '@antimatter/agents';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { CommandPalette } from './components/palette/CommandPalette';
import { TitleBar } from './components/layout/TitleBar';
import { Toolbar } from './components/layout/Toolbar';
import { FileExplorer } from './components/explorer/FileExplorer';
import { EditorShell } from './components/editor/EditorShell';
import { BottomPanel } from './components/terminal/BottomPanel';
import { AgentPanel } from './components/agents/AgentPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsDrawer } from './components/settings/SettingsDrawer';
import { ProviderSettingsModal } from './components/providers/ProviderSettingsModal';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { useAppStore, deriveSettingsFromStore } from './store/appStore';
import {
  getRecentProjects,
  loadProviders,
  loadSettings,
  saveSettings,
  writeWorkspaceFile
} from './lib/tauri';

export function App() {
  const {
    theme,
    agentDockSide,
    settingsOpen,
    providersOpen,
    commandPaletteOpen,
    welcomeVisible,
    openFiles,
    activeFilePath,
    providerConfigs,
    selectedProviderId,
    messages,
    setTheme,
    setAgentDockSide,
    setSettingsOpen,
    setProvidersOpen,
    setCommandPaletteOpen,
    setRecentProjects,
    setProviderConfigs,
    setSelectedProviderId,
    registerPaletteItems,
    appendMessage,
    appendLogs,
    setApprovalRequests,
    saveFileLocallyMarked
  } = useAppStore();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    void Promise.all([loadSettings(), getRecentProjects(), loadProviders()])
      .then(([settings, recentProjects, providers]) => {
        setTheme(settings.theme);
        setAgentDockSide(settings.agentDockSide);
        setRecentProjects(recentProjects);
        if (providers.length > 0) {
          setProviderConfigs(providers);
        }
        if (settings.defaultProviderId) {
          setSelectedProviderId(settings.defaultProviderId);
        }
      })
      .catch(() => undefined);
  }, [setAgentDockSide, setProviderConfigs, setRecentProjects, setSelectedProviderId, setTheme]);

  const selectedProvider = providerConfigs.find((provider) => provider.id === selectedProviderId);

  const saveActiveFile = async () => {
    const file = openFiles.find((entry) => entry.path === activeFilePath);
    if (!file) return;
    await writeWorkspaceFile(file.path, file.content);
    saveFileLocallyMarked(file.path);
  };

  useKeyboardShortcuts({
    'mod+p': () => setCommandPaletteOpen(true),
    'mod+,': () => setSettingsOpen(true),
    'mod+b': () => useAppStore.getState().toggleBottomPanel(),
    'mod+s': () => {
      void saveActiveFile();
    }
  });

  const paletteItems = useMemo(
    () => [
      { id: 'open-settings', title: 'Open Settings', category: 'General', action: () => setSettingsOpen(true) },
      { id: 'open-providers', title: 'Open Provider Settings', category: 'AI', action: () => setProvidersOpen(true) },
      { id: 'toggle-theme', title: 'Toggle Theme', category: 'View', action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'move-agent-left', title: 'Dock Agent Panel Left', category: 'Layout', action: () => setAgentDockSide('left') },
      { id: 'move-agent-right', title: 'Dock Agent Panel Right', category: 'Layout', action: () => setAgentDockSide('right') }
    ],
    [setAgentDockSide, setProvidersOpen, setSettingsOpen, setTheme, theme]
  );

  useEffect(() => {
    registerPaletteItems(paletteItems);
  }, [paletteItems, registerPaletteItems]);

  const onAgentPrompt = async (prompt: string) => {
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: prompt,
      createdAt: new Date().toISOString()
    };
    appendMessage(userMessage);
    const result = await runSingleAgent({ provider: selectedProvider, messages: [...messages, userMessage] });
    appendMessage(result.reply);
    appendLogs(result.logs);
    setApprovalRequests(result.approvalRequests);
  };

  const persistSettings = async () => {
    await saveSettings(deriveSettingsFromStore(useAppStore.getState()));
  };

  useEffect(() => {
    void persistSettings();
  }, [theme, agentDockSide]);

  return (
    <div className="app-shell">
      <TitleBar title={APP_NAME} />
      <Toolbar onOpenSettings={() => setSettingsOpen(true)} onOpenProviders={() => setProvidersOpen(true)} />

      <div className="workspace-shell">
        <PanelGroup autoSaveId="antimatter-root-layout" direction="horizontal">
          {agentDockSide === 'left' && (
            <>
              <Panel defaultSize={22} minSize={16}>
                <AgentPanel onSubmit={onAgentPrompt} />
              </Panel>
              <PanelResizeHandle className="resize-handle vertical" />
            </>
          )}

          <Panel defaultSize={18} minSize={12}>
            <FileExplorer />
          </Panel>
          <PanelResizeHandle className="resize-handle vertical" />

          <Panel>
            <PanelGroup autoSaveId="antimatter-center-layout" direction="vertical">
              <Panel>
                {welcomeVisible && openFiles.length === 0 ? <WelcomeScreen /> : <EditorShell />}
              </Panel>
              <PanelResizeHandle className="resize-handle horizontal" />
              <Panel defaultSize={24} minSize={14} collapsible>
                <BottomPanel />
              </Panel>
            </PanelGroup>
          </Panel>

          {agentDockSide === 'right' && (
            <>
              <PanelResizeHandle className="resize-handle vertical" />
              <Panel defaultSize={24} minSize={16}>
                <AgentPanel onSubmit={onAgentPrompt} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <StatusBar onToggleProviders={() => setProvidersOpen(true)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProviderSettingsModal open={providersOpen} onClose={() => setProvidersOpen(false)} />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
```

FILE: apps/desktop/src/components/agents/AgentPanel.tsx
```tsx
import { useMemo, useState } from 'react';
import { builtInTools } from '@antimatter/tools';
import { useAppStore } from '@/store/appStore';
import { DiffPreviewCard } from './DiffPreviewCard';

interface Props {
  onSubmit: (prompt: string) => Promise<void>;
}

export function AgentPanel({ onSubmit }: Props) {
  const { messages, actionLogs, approvalRequests, providerConfigs, selectedProviderId, setSelectedProviderId } = useAppStore();
  const [prompt, setPrompt] = useState('Summarize the current file and suggest the next refactor.');
  const selectedProvider = useMemo(
    () => providerConfigs.find((provider) => provider.id === selectedProviderId),
    [providerConfigs, selectedProviderId]
  );

  return (
    <aside className="panel agent-panel">
      <div className="panel__header stacked-gap">
        <div>
          <h3>Agent</h3>
          <p>Single-agent workflow with explicit tools, logs, and approvals.</p>
        </div>
        <select value={selectedProviderId ?? ''} onChange={(event) => setSelectedProviderId(event.target.value || undefined)}>
          <option value="">No provider selected</option>
          {providerConfigs.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label} · {provider.model}
            </option>
          ))}
        </select>
      </div>

      <div className="agent-warning">
        Antimatter does not provide a model. Speed, latency, and quality depend on the provider, endpoint, or hardware you connect.
      </div>

      <div className="agent-section">
        <strong>Conversation</strong>
        <div className="message-list">
          {messages.map((message) => (
            <article key={message.id} className={`message message--${message.role}`}>
              <header>{message.role}</header>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="agent-section">
        <strong>Tools</strong>
        <div className="tool-pills">
          {builtInTools.map((tool) => (
            <span key={tool.id} className="pill">
              {tool.label}
            </span>
          ))}
        </div>
      </div>

      <div className="agent-section">
        <strong>Action log</strong>
        <div className="log-list">
          {actionLogs.length === 0 ? (
            <div className="empty-state compact">No actions yet.</div>
          ) : (
            actionLogs.map((log) => (
              <article key={log.id} className="log-entry">
                <header>{log.title}</header>
                <p>{log.detail}</p>
              </article>
            ))
          )}
        </div>
      </div>

      {approvalRequests.length > 0 && (
        <div className="agent-section">
          <strong>Approvals</strong>
          {approvalRequests.map((request) => (
            <DiffPreviewCard key={request.id} request={request} />
          ))}
        </div>
      )}

      <div className="agent-compose">
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
        <button
          className="button primary"
          onClick={() => {
            void onSubmit(prompt);
            setPrompt('');
          }}
        >
          Run agent
        </button>
        <div className="helper-text">Current provider: {selectedProvider ? `${selectedProvider.label} / ${selectedProvider.model}` : 'none selected'}</div>
      </div>
    </aside>
  );
}
```

FILE: apps/desktop/src/components/agents/DiffPreviewCard.tsx
```tsx
import type { ApprovalRequest } from '@antimatter/shared';

interface Props {
  request: ApprovalRequest;
}

export function DiffPreviewCard({ request }: Props) {
  return (
    <article className="diff-card">
      <header>
        <strong>{request.title}</strong>
        <span className={`risk-badge ${request.risk}`}>{request.risk}</span>
      </header>
      <p>{request.description}</p>
      {request.diff && (
        <div className="diff-grid">
          <div>
            <h5>Original</h5>
            <pre>{request.diff.original}</pre>
          </div>
          <div>
            <h5>Proposed</h5>
            <pre>{request.diff.proposed}</pre>
          </div>
        </div>
      )}
      <div className="diff-actions">
        <button className="button subtle">Reject</button>
        <button className="button primary">Approve</button>
      </div>
    </article>
  );
}
```

FILE: apps/desktop/src/components/editor/EditorShell.tsx
```tsx
import Editor from '@monaco-editor/react';
import { useAppStore } from '@/store/appStore';

export function EditorShell() {
  const { openFiles, activeFilePath, theme, openFile, updateOpenFileContent } = useAppStore();
  const activeFile = openFiles.find((file) => file.path === activeFilePath) ?? openFiles[0];

  if (!activeFile) {
    return <div className="panel editor-panel empty-state">Open a file to start editing.</div>;
  }

  return (
    <section className="panel editor-panel">
      <div className="tabs">
        {openFiles.map((file) => (
          <button key={file.path} className={`tab ${file.path === activeFile.path ? 'active' : ''}`} onClick={() => openFile(file)}>
            {file.name}
            {file.dirty ? ' •' : ''}
          </button>
        ))}
      </div>
      <div className="editor-surface">
        <Editor
          height="100%"
          language={activeFile.language}
          value={activeFile.content}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onChange={(value) => updateOpenFileContent(activeFile.path, value ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            smoothScrolling: true,
            padding: { top: 16 },
            automaticLayout: true
          }}
        />
      </div>
    </section>
  );
}
```

FILE: apps/desktop/src/components/explorer/FileExplorer.tsx
```tsx
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { openFileAsTab, readDirectory } from '@/lib/tauri';

export function FileExplorer() {
  const { workspacePath, workspaceEntries, setWorkspaceEntries, setWorkspacePath, openFile } = useAppStore();
  const [pathInput, setPathInput] = useState(workspacePath ?? '');

  const handleLoad = async () => {
    if (!pathInput) return;
    const entries = await readDirectory(pathInput);
    setWorkspacePath(pathInput);
    setWorkspaceEntries(entries);
  };

  const handleOpen = async (path: string, isDirectory: boolean) => {
    if (isDirectory) return;
    const file = await openFileAsTab(path);
    openFile(file);
  };

  return (
    <aside className="panel explorer-panel">
      <div className="panel__header">
        <div>
          <h3>Explorer</h3>
          <p>Open a local folder. Antimatter stays local-first.</p>
        </div>
      </div>
      <div className="explorer-pathbar">
        <input
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          placeholder="/path/to/workspace"
        />
        <button className="button primary" onClick={handleLoad}>
          Open
        </button>
      </div>
      <div className="explorer-tree">
        {workspaceEntries.length === 0 ? (
          <div className="empty-state compact">No files loaded yet.</div>
        ) : (
          workspaceEntries.map((entry) => (
            <button
              key={entry.path}
              className="tree-item"
              onClick={() => {
                void handleOpen(entry.path, entry.isDirectory);
              }}
            >
              <span>{entry.isDirectory ? '📁' : '📄'}</span>
              <span>{entry.name}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
```

FILE: apps/desktop/src/components/layout/StatusBar.tsx
```tsx
import { useAppStore } from '@/store/appStore';

interface Props {
  onToggleProviders: () => void;
}

export function StatusBar({ onToggleProviders }: Props) {
  const { theme, workspacePath, openFiles, providerConfigs, selectedProviderId } = useAppStore();
  const provider = providerConfigs.find((entry) => entry.id === selectedProviderId);

  return (
    <footer className="statusbar">
      <div className="statusbar__left">
        <span>{theme === 'dark' ? 'Dark' : 'Light'} theme</span>
        <span>{workspacePath ?? 'No workspace open'}</span>
      </div>
      <div className="statusbar__right">
        <span>{openFiles.length} open tabs</span>
        <button className="status-link" onClick={onToggleProviders}>
          {provider ? `${provider.label} · ${provider.model}` : 'Configure provider'}
        </button>
      </div>
    </footer>
  );
}
```

FILE: apps/desktop/src/components/layout/TitleBar.tsx
```tsx
interface Props {
  title: string;
}

export function TitleBar({ title }: Props) {
  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <div className="brand-mark">A</div>
        <div>
          <strong>{title}</strong>
          <span>Local-first agentic IDE</span>
        </div>
      </div>
      <div className="titlebar__meta">BYOK · No signup · No cloud lock-in</div>
    </header>
  );
}
```

FILE: apps/desktop/src/components/layout/Toolbar.tsx
```tsx
interface Props {
  onOpenSettings: () => void;
  onOpenProviders: () => void;
}

const menus = ['File', 'Edit', 'View', 'Navigate', 'Selection', 'Terminal', 'Agents', 'Settings', 'Help'];

export function Toolbar({ onOpenSettings, onOpenProviders }: Props) {
  return (
    <div className="toolbar">
      <nav className="toolbar__menus">
        {menus.map((menu) => (
          <button key={menu} className="toolbar__menu-item">
            {menu}
          </button>
        ))}
      </nav>
      <div className="toolbar__actions">
        <button className="button subtle">Open Folder</button>
        <button className="button subtle">Save</button>
        <button className="button subtle">Save As</button>
        <button className="button" onClick={onOpenProviders}>
          Providers
        </button>
        <button className="button primary" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </div>
  );
}
```

FILE: apps/desktop/src/components/palette/CommandPalette.tsx
```tsx
import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const { paletteItems } = useAppStore();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? paletteItems.filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(value))
      : paletteItems;
  }, [paletteItems, query]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal palette" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          className="palette-input"
          placeholder="Type a command…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="palette-results">
          {filtered.map((item) => (
            <button
              key={item.id}
              className="palette-item"
              onClick={() => {
                item.action();
                onClose();
              }}
            >
              <strong>{item.title}</strong>
              <span>{item.category}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

FILE: apps/desktop/src/components/providers/ProviderSettingsModal.tsx
```tsx
import { useState } from 'react';
import type { ProviderConfig, ProviderKind } from '@antimatter/shared';
import { providerDefaults } from '@antimatter/providers';
import { saveProvider, testProviderConnection } from '@/lib/tauri';
import { useAppStore } from '@/store/appStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProviderSettingsModal({ open, onClose }: Props) {
  const { providerConfigs, upsertProviderConfig, setSelectedProviderId } = useAppStore();
  const template = providerDefaults[0];
  const [draft, setDraft] = useState<ProviderConfig>({
    id: crypto.randomUUID(),
    label: template.label,
    kind: template.kind,
    model: template.model,
    baseUrl: '',
    apiKeyStored: false,
    status: 'unknown',
    notes: template.notes
  });
  const [apiKey, setApiKey] = useState('');
  const [feedback, setFeedback] = useState('');

  if (!open) return null;

  const handleKindChange = (kind: ProviderKind) => {
    const preset = providerDefaults.find((entry) => entry.kind === kind)!;
    setDraft((current) => ({
      ...current,
      kind,
      label: preset.label,
      model: preset.model,
      notes: preset.notes
    }));
  };

  const handleSave = async () => {
    const next = { ...draft, apiKeyStored: Boolean(apiKey) || draft.apiKeyStored };
    await saveProvider(next, apiKey || undefined);
    upsertProviderConfig(next);
    setSelectedProviderId(next.id);
    setFeedback('Provider saved locally. Antimatter does not store bundled credentials.');
    setApiKey('');
  };

  const handleTest = async () => {
    const result = await testProviderConnection(draft);
    setFeedback(result.message);
    setDraft((current) => ({ ...current, status: result.ok ? 'connected' : 'failed' }));
  };

  return (
    <div className="overlay">
      <div className="modal wide">
        <div className="panel__header">
          <div>
            <h3>Providers</h3>
            <p>Bring your own API key or endpoint. Antimatter does not provide the model itself.</p>
          </div>
          <button className="button subtle" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="provider-layout">
          <div className="provider-list">
            {providerConfigs.map((provider) => (
              <button key={provider.id} className="provider-card" onClick={() => setDraft(provider)}>
                <strong>{provider.label}</strong>
                <span>{provider.kind}</span>
                <span>Status: {provider.status}</span>
              </button>
            ))}
          </div>

          <div className="provider-form">
            <label>
              Provider kind
              <select value={draft.kind} onChange={(event) => handleKindChange(event.target.value as ProviderKind)}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
                <option value="local">Local endpoint</option>
                <option value="openai-compatible">OpenAI-compatible endpoint</option>
              </select>
            </label>

            <label>
              Label
              <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
            </label>

            <label>
              Model
              <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
            </label>

            <label>
              Base URL
              <input
                placeholder="Optional for managed providers, required for local/custom endpoints"
                value={draft.baseUrl ?? ''}
                onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
              />
            </label>

            <label>
              API key
              <input
                type="password"
                placeholder="Stored securely where available"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>

            <label>
              Notes
              <textarea value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} />
            </label>

            <div className="row-actions">
              <button className="button subtle" onClick={handleTest}>
                Test connection
              </button>
              <button className="button primary" onClick={handleSave}>
                Save provider
              </button>
            </div>

            <div className="helper-text">{feedback}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

FILE: apps/desktop/src/components/settings/SettingsDrawer.tsx
```tsx
import { useAppStore } from '@/store/appStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: Props) {
  const { theme, setTheme, agentDockSide, setAgentDockSide, bottomPanelOpen, toggleBottomPanel } = useAppStore();

  if (!open) return null;

  return (
    <div className="overlay">
      <div className="modal drawer">
        <div className="panel__header">
          <div>
            <h3>Settings</h3>
            <p>Local-only defaults. Telemetry stays off by default.</p>
          </div>
          <button className="button subtle" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="form-section">
          <label>
            Theme
            <select value={theme} onChange={(event) => setTheme(event.target.value as 'dark' | 'light')}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label>
            Agent panel dock
            <select value={agentDockSide} onChange={(event) => setAgentDockSide(event.target.value as 'left' | 'right')}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>

          <label className="checkbox-row">
            <input type="checkbox" checked={bottomPanelOpen} onChange={toggleBottomPanel} />
            <span>Show bottom panel</span>
          </label>
        </section>
      </div>
    </div>
  );
}
```

FILE: apps/desktop/src/components/terminal/BottomPanel.tsx
```tsx
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { executeTerminal } from '@/lib/tauri';

export function BottomPanel() {
  const { bottomPanelTab, setBottomPanelTab, workspacePath } = useAppStore();
  const [command, setCommand] = useState('npm run test');
  const [output, setOutput] = useState('Terminal output will appear here. Command execution is guarded by policy.');

  const run = async () => {
    const result = await executeTerminal({ cwd: workspacePath ?? '.', command });
    setOutput(
      [result.message, result.stdout, result.stderr].filter(Boolean).join('\n\n') || 'Command completed with no output.'
    );
  };

  return (
    <section className="panel bottom-panel">
      <div className="panel__header inline-tabs">
        {(['terminal', 'problems', 'output'] as const).map((tab) => (
          <button key={tab} className={`tab ${tab === bottomPanelTab ? 'active' : ''}`} onClick={() => setBottomPanelTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      {bottomPanelTab === 'terminal' && (
        <div className="terminal-panel">
          <div className="terminal-input-row">
            <input value={command} onChange={(event) => setCommand(event.target.value)} />
            <button className="button primary" onClick={run}>
              Run
            </button>
          </div>
          <pre className="terminal-output">{output}</pre>
        </div>
      )}
      {bottomPanelTab === 'problems' && <div className="empty-state compact">No problems reported.</div>}
      {bottomPanelTab === 'output' && (
        <div className="empty-state compact">Provider tests, agent traces, and future build output will appear here.</div>
      )}
    </section>
  );
}
```

FILE: apps/desktop/src/components/welcome/WelcomeScreen.tsx
```tsx
import { APP_NAME, APP_TAGLINE } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';

export function WelcomeScreen() {
  const { recentProjects, setProvidersOpen, setSettingsOpen } = useAppStore();

  return (
    <section className="panel welcome-screen">
      <div className="hero-card">
        <div className="eyebrow">Futuristic. Local-first. Open-source-friendly.</div>
        <h1>{APP_NAME}</h1>
        <p>{APP_TAGLINE}</p>
        <div className="row-actions">
          <button className="button primary" onClick={() => setProvidersOpen(true)}>
            Configure providers
          </button>
          <button className="button subtle" onClick={() => setSettingsOpen(true)}>
            Open settings
          </button>
        </div>
      </div>

      <div className="welcome-grid">
        <article className="info-card">
          <h3>What Antimatter is</h3>
          <ul>
            <li>Desktop-first agentic IDE built with Tauri, Rust, React, and Monaco</li>
            <li>No signup or cloud account required</li>
            <li>Use OpenAI, Anthropic, Gemini, local endpoints, or custom OpenAI-compatible APIs</li>
          </ul>
        </article>
        <article className="info-card">
          <h3>Important reality check</h3>
          <ul>
            <li>Antimatter does not ship a model</li>
            <li>Speed and quality depend on your provider, endpoint, and hardware</li>
            <li>Risky actions should go through approvals and diff previews</li>
          </ul>
        </article>
      </div>

      <div className="info-card">
        <h3>Recent projects</h3>
        {recentProjects.length === 0 ? (
          <p>No recent projects yet.</p>
        ) : (
          <div className="recent-list">
            {recentProjects.map((project) => (
              <div key={project.path} className="recent-item">
                <strong>{project.name}</strong>
                <span>{project.path}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

FILE: apps/desktop/src/hooks/useKeyboardShortcuts.ts
```ts
import { useEffect } from 'react';

export function useKeyboardShortcuts(bindings: Record<string, () => void>) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = [event.metaKey || event.ctrlKey ? 'mod' : '', event.shiftKey ? 'shift' : '', event.key.toLowerCase()]
        .filter(Boolean)
        .join('+');

      const callback = bindings[key];
      if (callback) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindings]);
}
```

FILE: apps/desktop/src/lib/tauri.ts
```ts
import { invoke } from '@tauri-apps/api/core';
import type {
  AppSettings,
  OpenFile,
  ProviderConfig,
  ProviderTestResult,
  RecentProject,
  SearchResult,
  TerminalRequest,
  TerminalResponse,
  WorkspaceEntry
} from '@antimatter/shared';

export async function readDirectory(path: string): Promise<WorkspaceEntry[]> {
  return invoke('read_directory', { path });
}

export async function readWorkspaceFile(path: string): Promise<string> {
  return invoke('read_workspace_file', { path });
}

export async function writeWorkspaceFile(path: string, content: string): Promise<void> {
  return invoke('write_workspace_file', { path, content });
}

export async function searchWorkspace(root: string, query: string): Promise<SearchResult[]> {
  return invoke('search_workspace', { root, query });
}

export async function saveRecentProject(path: string): Promise<void> {
  return invoke('save_recent_project', { path });
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  return invoke('get_recent_projects');
}

export async function loadSettings(): Promise<AppSettings> {
  return invoke('load_settings');
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke('save_settings', { settings });
}

export async function loadProviders(): Promise<ProviderConfig[]> {
  return invoke('load_providers');
}

export async function saveProvider(config: ProviderConfig, apiKey?: string): Promise<void> {
  return invoke('save_provider', { config, apiKey });
}

export async function testProviderConnection(config: ProviderConfig): Promise<ProviderTestResult> {
  return invoke('test_provider_connection', { config });
}

export async function executeTerminal(request: TerminalRequest): Promise<TerminalResponse> {
  return invoke('execute_terminal_command', { request });
}

export async function openFileAsTab(path: string): Promise<OpenFile> {
  const content = await readWorkspaceFile(path);
  const name = path.split(/[\\/]/).pop() ?? path;
  const language = inferLanguage(name);
  return { path, name, content, language };
}

function inferLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'js':
      return 'javascript';
    case 'jsx':
      return 'javascript';
    case 'rs':
      return 'rust';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'toml':
      return 'ini';
    default:
      return 'plaintext';
  }
}
```

FILE: apps/desktop/src/main.tsx
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

FILE: apps/desktop/src/store/appStore.ts
```ts
import { create } from 'zustand';
import type {
  AgentActionLog,
  AgentDockSide,
  AgentMessage,
  AppSettings,
  ApprovalRequest,
  BottomPanelTab,
  OpenFile,
  ProviderConfig,
  RecentProject,
  ThemeMode,
  WorkspaceEntry
} from '@antimatter/shared';
import { providerDefaults } from '@antimatter/providers';

interface PaletteItem {
  id: string;
  title: string;
  category: string;
  action: () => void;
}

interface AppState {
  theme: ThemeMode;
  workspacePath?: string;
  workspaceEntries: WorkspaceEntry[];
  openFiles: OpenFile[];
  activeFilePath?: string;
  agentDockSide: AgentDockSide;
  bottomPanelTab: BottomPanelTab;
  bottomPanelOpen: boolean;
  settingsOpen: boolean;
  providersOpen: boolean;
  commandPaletteOpen: boolean;
  welcomeVisible: boolean;
  recentProjects: RecentProject[];
  providerConfigs: ProviderConfig[];
  messages: AgentMessage[];
  actionLogs: AgentActionLog[];
  approvalRequests: ApprovalRequest[];
  selectedProviderId?: string;
  paletteItems: PaletteItem[];
  setTheme: (theme: ThemeMode) => void;
  setWorkspacePath: (path?: string) => void;
  setWorkspaceEntries: (entries: WorkspaceEntry[]) => void;
  openFile: (file: OpenFile) => void;
  updateOpenFileContent: (path: string, content: string) => void;
  saveFileLocallyMarked: (path: string) => void;
  setAgentDockSide: (side: AgentDockSide) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  toggleBottomPanel: () => void;
  setSettingsOpen: (open: boolean) => void;
  setProvidersOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setWelcomeVisible: (visible: boolean) => void;
  setRecentProjects: (projects: RecentProject[]) => void;
  setProviderConfigs: (providers: ProviderConfig[]) => void;
  upsertProviderConfig: (provider: ProviderConfig) => void;
  appendMessage: (message: AgentMessage) => void;
  appendLogs: (logs: AgentActionLog[]) => void;
  setApprovalRequests: (requests: ApprovalRequest[]) => void;
  setSelectedProviderId: (id?: string) => void;
  registerPaletteItems: (items: PaletteItem[]) => void;
}

const initialProviders: ProviderConfig[] = providerDefaults.map((provider, index) => ({
  id: `provider-${index + 1}`,
  label: provider.label,
  kind: provider.kind,
  model: provider.model,
  notes: provider.notes,
  apiKeyStored: false,
  status: 'unknown'
}));

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  workspaceEntries: [],
  openFiles: [],
  agentDockSide: 'right',
  bottomPanelTab: 'terminal',
  bottomPanelOpen: true,
  settingsOpen: false,
  providersOpen: false,
  commandPaletteOpen: false,
  welcomeVisible: true,
  recentProjects: [],
  providerConfigs: initialProviders,
  messages: [
    {
      id: crypto.randomUUID(),
      role: 'system',
      content:
        'Antimatter is local-first. Bring your own provider key or custom endpoint. Performance depends on the connected provider or hardware you already control.',
      createdAt: new Date().toISOString()
    }
  ],
  actionLogs: [],
  approvalRequests: [],
  paletteItems: [],
  setTheme: (theme) => set({ theme }),
  setWorkspacePath: (workspacePath) => set({ workspacePath }),
  setWorkspaceEntries: (workspaceEntries) => set({ workspaceEntries }),
  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.some((entry) => entry.path === file.path);
      return {
        openFiles: exists ? state.openFiles : [...state.openFiles, file],
        activeFilePath: file.path,
        welcomeVisible: false
      };
    }),
  updateOpenFileContent: (path, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.path === path ? { ...file, content, dirty: true } : file
      )
    })),
  saveFileLocallyMarked: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.path === path ? { ...file, dirty: false } : file
      )
    })),
  setAgentDockSide: (agentDockSide) => set({ agentDockSide }),
  setBottomPanelTab: (bottomPanelTab) => set({ bottomPanelTab }),
  toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setProvidersOpen: (providersOpen) => set({ providersOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setWelcomeVisible: (welcomeVisible) => set({ welcomeVisible }),
  setRecentProjects: (recentProjects) => set({ recentProjects }),
  setProviderConfigs: (providerConfigs) => set({ providerConfigs }),
  upsertProviderConfig: (provider) =>
    set((state) => ({
      providerConfigs: state.providerConfigs.some((entry) => entry.id === provider.id)
        ? state.providerConfigs.map((entry) => (entry.id === provider.id ? provider : entry))
        : [...state.providerConfigs, provider]
    })),
  appendMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  appendLogs: (logs) => set((state) => ({ actionLogs: [...logs, ...state.actionLogs].slice(0, 100) })),
  setApprovalRequests: (approvalRequests) => set({ approvalRequests }),
  setSelectedProviderId: (selectedProviderId) => set({ selectedProviderId }),
  registerPaletteItems: (paletteItems) => set({ paletteItems })
}));

export function deriveSettingsFromStore(state: AppState): AppSettings {
  return {
    theme: state.theme,
    agentDockSide: state.agentDockSide,
    defaultProviderId: state.selectedProviderId,
    telemetryEnabled: false,
    showWelcomeOnLaunch: state.welcomeVisible
  };
}
```

FILE: apps/desktop/src/styles/global.css
```css
:root {
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --radius-lg: 18px;
  --radius-md: 12px;
  --radius-sm: 10px;
  --shadow-panel: 0 12px 40px rgba(0, 0, 0, 0.18);
  --shadow-soft: 0 6px 20px rgba(0, 0, 0, 0.12);
}

:root[data-theme='dark'] {
  --bg: #090b11;
  --bg-elevated: rgba(17, 22, 34, 0.92);
  --bg-panel: rgba(19, 25, 39, 0.94);
  --bg-muted: rgba(33, 41, 63, 0.9);
  --border: rgba(134, 153, 196, 0.18);
  --text: #f4f7fb;
  --text-muted: #9eb0cb;
  --accent: #67a0ff;
  --accent-strong: #8e7dff;
  --success: #5ed6a8;
  --danger: #ff7f90;
}

:root[data-theme='light'] {
  --bg: #edf1f9;
  --bg-elevated: rgba(255, 255, 255, 0.96);
  --bg-panel: rgba(255, 255, 255, 0.97);
  --bg-muted: rgba(232, 238, 248, 0.95);
  --border: rgba(17, 24, 39, 0.12);
  --text: #0e1729;
  --text-muted: #58657c;
  --accent: #2c66ff;
  --accent-strong: #5a46e6;
  --success: #1d8f68;
  --danger: #d6455d;
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; width: 100%; height: 100%; }
body {
  font-family: var(--font-sans);
  background:
    radial-gradient(circle at top, rgba(101, 138, 255, 0.18), transparent 32%),
    radial-gradient(circle at bottom right, rgba(142, 125, 255, 0.16), transparent 24%),
    var(--bg);
  color: var(--text);
}
button, input, textarea, select {
  font: inherit;
  color: inherit;
}
button { cursor: pointer; }

.app-shell {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  height: 100%;
}
.titlebar, .toolbar, .statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border);
  background: rgba(6, 10, 19, 0.28);
  backdrop-filter: blur(16px);
}
.statusbar {
  border-top: 1px solid var(--border);
  border-bottom: none;
  font-size: 12px;
}
.titlebar__brand { display: flex; align-items: center; gap: 12px; }
.titlebar__brand strong, .titlebar__brand span { display: block; }
.titlebar__brand span, .titlebar__meta, .helper-text, .statusbar span { color: var(--text-muted); }
.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: white;
  box-shadow: var(--shadow-soft);
}
.toolbar__menus, .toolbar__actions, .statusbar__left, .statusbar__right, .row-actions { display: flex; align-items: center; gap: 10px; }
.toolbar__menu-item, .status-link {
  background: transparent;
  border: none;
  color: var(--text-muted);
}
.workspace-shell { min-height: 0; padding: 14px; }
.resize-handle { background: transparent; position: relative; }
.resize-handle.vertical { width: 8px; }
.resize-handle.horizontal { height: 8px; }
.resize-handle::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 999px;
  background: var(--border);
}
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}
.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.panel__header h3 { margin: 0 0 4px; }
.panel__header p { margin: 0; color: var(--text-muted); font-size: 13px; }
.stacked-gap { align-items: stretch; }
input, textarea, select {
  width: 100%;
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
textarea { resize: vertical; }
.button {
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  background: var(--bg-muted);
}
.button.primary {
  color: white;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
}
.button.subtle { border-color: var(--border); }
.explorer-pathbar, .terminal-input-row { display: flex; gap: 10px; padding: 16px; }
.explorer-tree, .message-list, .log-list, .palette-results { overflow: auto; }
.explorer-tree { padding: 0 10px 14px; }
.tree-item, .provider-card, .palette-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-muted);
  padding: 12px;
  text-align: left;
}
.editor-panel { min-height: 0; }
.tabs { display: flex; gap: 8px; padding: 12px; border-bottom: 1px solid var(--border); overflow: auto; }
.tab {
  padding: 8px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}
.tab.active { border-color: var(--border); background: var(--bg-muted); color: var(--text); }
.editor-surface { min-height: 0; flex: 1; }
.bottom-panel { min-height: 0; }
.inline-tabs { padding-bottom: 0; }
.terminal-panel { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.terminal-output {
  margin: 0 16px 16px;
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: #06080f;
  color: #d6e0f0;
  min-height: 120px;
  overflow: auto;
}
.agent-panel, .welcome-screen { min-height: 0; }
.agent-warning {
  margin: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(103, 160, 255, 0.22);
  background: rgba(103, 160, 255, 0.08);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 13px;
}
.agent-section { padding: 0 16px 16px; }
.message-list, .log-list { display: flex; flex-direction: column; gap: 10px; max-height: 180px; padding-top: 12px; }
.message, .log-entry, .diff-card, .info-card, .hero-card {
  border: 1px solid var(--border);
  background: var(--bg-muted);
  border-radius: var(--radius-lg);
  padding: 14px;
}
.message header, .log-entry header { text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; color: var(--text-muted); }
.message p, .log-entry p, .diff-card p { white-space: pre-wrap; }
.tool-pills { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 12px; }
.pill { padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-muted); font-size: 12px; }
.agent-compose { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-top: 1px solid var(--border); margin-top: auto; }
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow-panel);
}
.modal.wide { width: min(1080px, calc(100vw - 32px)); }
.modal.drawer { width: min(520px, calc(100vw - 32px)); }
.form-section, .provider-form { display: flex; flex-direction: column; gap: 14px; padding: 16px; }
.provider-layout { display: grid; grid-template-columns: 280px 1fr; min-height: 560px; }
.provider-list { padding: 16px; border-right: 1px solid var(--border); overflow: auto; }
.checkbox-row { display: flex; align-items: center; gap: 10px; }
.checkbox-row input { width: auto; }
.palette { padding: 12px; }
.palette-input { font-size: 16px; }
.palette-item { margin-top: 10px; }
.hero-card {
  padding: 24px;
  background: linear-gradient(135deg, rgba(103, 160, 255, 0.16), rgba(142, 125, 255, 0.14));
}
.eyebrow { color: var(--accent); text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; }
.hero-card h1 { margin: 8px 0; font-size: 42px; }
.hero-card p { margin: 0 0 16px; color: var(--text-muted); font-size: 16px; max-width: 60ch; }
.welcome-screen { padding: 20px; gap: 18px; overflow: auto; }
.welcome-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.info-card ul { margin: 0; padding-left: 18px; color: var(--text-muted); }
.recent-list { display: grid; gap: 10px; }
.recent-item { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: var(--radius-md); background: var(--bg-muted); }
.empty-state { display: grid; place-items: center; color: var(--text-muted); }
.empty-state.compact { padding: 24px; }
.diff-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.diff-grid pre {
  margin: 0;
  min-height: 120px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: rgba(6, 8, 15, 0.74);
  overflow: auto;
}
.diff-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }
.risk-badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  text-transform: uppercase;
}
.risk-badge.high { background: rgba(255, 127, 144, 0.16); color: var(--danger); }
.risk-badge.medium { background: rgba(255, 190, 92, 0.16); color: #d7a248; }
.risk-badge.low { background: rgba(94, 214, 168, 0.16); color: var(--success); }

@media (max-width: 1100px) {
  .provider-layout, .welcome-grid, .diff-grid { grid-template-columns: 1fr; }
  .toolbar { flex-direction: column; align-items: flex-start; }
}
```

FILE: apps/desktop/src-tauri/Cargo.toml
```toml
[package]
name = "antimatter-desktop"
version = "0.1.0"
description = "Antimatter desktop shell"
authors = ["OpenAI"]
edition = "2021"

[lib]
name = "antimatter_desktop_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
keyring = "3"
walkdir = "2"
```

FILE: apps/desktop/src-tauri/build.rs
```rs
fn main() {
  tauri_build::build()
}
```

FILE: apps/desktop/src-tauri/capabilities/default.json
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for the Antimatter desktop app.",
  "windows": ["main"],
  "permissions": ["core:default", "shell:default"]
}
```

FILE: apps/desktop/src-tauri/src/commands/mod.rs
```rs
pub mod provider;
pub mod settings;
pub mod workspace;
```

FILE: apps/desktop/src-tauri/src/commands/provider.rs
```rs
use crate::{models::{ProviderConfig, ProviderTestResult}, storage};

#[tauri::command]
pub fn load_providers() -> Vec<ProviderConfig> {
    storage::load_providers()
}

#[tauri::command]
pub fn save_provider(config: ProviderConfig, api_key: Option<String>) -> Result<(), String> {
    storage::save_provider(&config, api_key)
}

#[tauri::command]
pub fn test_provider_connection(config: ProviderConfig) -> ProviderTestResult {
    let has_secret = storage::get_provider_secret(&config.id).is_some() || config.api_key_stored;
    if !has_secret && config.kind != "local" {
        return ProviderTestResult {
            ok: false,
            message: "No API key is stored for this provider yet. Save one first, then test again.".into(),
        };
    }

    if config.kind == "local" && config.base_url.as_deref().unwrap_or_default().is_empty() {
        return ProviderTestResult {
            ok: false,
            message: "Local endpoints need a base URL. Antimatter does not include a local model binary.".into(),
        };
    }

    ProviderTestResult {
        ok: true,
        message: format!(
            "{} is configured. Replace this stub with a live network probe if you want runtime validation.",
            config.label
        ),
    }
}
```

FILE: apps/desktop/src-tauri/src/commands/settings.rs
```rs
use crate::{models::AppSettings, storage};

#[tauri::command]
pub fn load_settings() -> AppSettings {
    storage::load_settings()
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    storage::save_settings(&settings)
}

#[tauri::command]
pub fn get_recent_projects() -> Vec<crate::models::RecentProject> {
    storage::get_recent_projects()
}

#[tauri::command]
pub fn save_recent_project(path: String) -> Result<(), String> {
    storage::save_recent_project(&path)
}
```

FILE: apps/desktop/src-tauri/src/commands/workspace.rs
```rs
use crate::models::{SearchResult, TerminalRequest, TerminalResponse, WorkspaceEntry};
use std::{fs, path::PathBuf, process::Command};
use walkdir::WalkDir;

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<WorkspaceEntry>, String> {
    let entries = fs::read_dir(path).map_err(|err| err.to_string())?;
    let mut items = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        items.push(WorkspaceEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            is_directory: path.is_dir(),
        });
    }

    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(items)
}

#[tauri::command]
pub fn read_workspace_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_workspace_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn search_workspace(root: String, query: String) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();
    for entry in WalkDir::new(root).max_depth(6).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.is_file() {
            if let Ok(content) = fs::read_to_string(path) {
                for (index, line) in content.lines().enumerate() {
                    if line.to_lowercase().contains(&query.to_lowercase()) {
                        results.push(SearchResult {
                            file_path: path.to_string_lossy().to_string(),
                            line: index + 1,
                            preview: line.trim().to_string(),
                        });
                    }
                    if results.len() >= 100 {
                        return Ok(results);
                    }
                }
            }
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn execute_terminal_command(request: TerminalRequest) -> TerminalResponse {
    let denied = ["rm -rf", "shutdown", "reboot", "mkfs", ":(){:|:&};:"];
    if denied.iter().any(|pattern| request.command.contains(pattern)) {
        return TerminalResponse {
            allowed: false,
            stdout: String::new(),
            stderr: String::new(),
            exit_code: 126,
            message: Some("Command denied by the starter execution policy. Add an approval flow before enabling destructive commands.".into()),
        };
    }

    let cwd = PathBuf::from(request.cwd);
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &request.command])
            .current_dir(cwd)
            .output()
    } else {
        Command::new("sh")
            .args(["-lc", &request.command])
            .current_dir(cwd)
            .output()
    };

    match output {
        Ok(output) => TerminalResponse {
            allowed: true,
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or_default(),
            message: Some("Guarded terminal execution completed. For production use, add explicit approval policies and process streaming.".into()),
        },
        Err(err) => TerminalResponse {
            allowed: false,
            stdout: String::new(),
            stderr: err.to_string(),
            exit_code: 1,
            message: Some("Terminal execution failed before process launch.".into()),
        },
    }
}
```

FILE: apps/desktop/src-tauri/src/lib.rs
```rs
mod commands;
mod models;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::settings::get_recent_projects,
            commands::settings::save_recent_project,
            commands::provider::load_providers,
            commands::provider::save_provider,
            commands::provider::test_provider_connection,
            commands::workspace::read_directory,
            commands::workspace::read_workspace_file,
            commands::workspace::write_workspace_file,
            commands::workspace::search_workspace,
            commands::workspace::execute_terminal_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Antimatter");
}
```

FILE: apps/desktop/src-tauri/src/main.rs
```rs
fn main() {
    antimatter_desktop_lib::run();
}
```

FILE: apps/desktop/src-tauri/src/models.rs
```rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub base_url: Option<String>,
    pub model: String,
    pub api_key_stored: bool,
    pub status: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTestResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub agent_dock_side: String,
    pub default_provider_id: Option<String>,
    pub telemetry_enabled: bool,
    pub show_welcome_on_launch: bool,
    pub custom_openai_base_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub file_path: String,
    pub line: usize,
    pub preview: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalRequest {
    pub cwd: String,
    pub command: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalResponse {
    pub allowed: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub message: Option<String>,
}
```

FILE: apps/desktop/src-tauri/src/storage.rs
```rs
use crate::models::{AppSettings, ProviderConfig, RecentProject};
use keyring::Entry;
use std::{fs, path::PathBuf};

const APP_DIR: &str = "antimatter";
const SETTINGS_FILE: &str = "settings.json";
const PROVIDERS_FILE: &str = "providers.json";
const RECENTS_FILE: &str = "recent_projects.json";
const KEYRING_SERVICE: &str = "Antimatter";

fn app_config_dir() -> PathBuf {
    let base = std::env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|_| PathBuf::from("."));

    let dir = base.join(format!(".{}", APP_DIR));
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

fn read_json<T: serde::de::DeserializeOwned>(file_name: &str) -> Option<T> {
    let path = app_config_dir().join(file_name);
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_json<T: serde::Serialize>(file_name: &str, data: &T) -> Result<(), String> {
    let path = app_config_dir().join(file_name);
    let content = serde_json::to_string_pretty(data).map_err(|err| err.to_string())?;
    fs::write(path, content).map_err(|err| err.to_string())
}

pub fn load_settings() -> AppSettings {
    read_json(SETTINGS_FILE).unwrap_or(AppSettings {
        theme: "dark".into(),
        agent_dock_side: "right".into(),
        default_provider_id: None,
        telemetry_enabled: false,
        show_welcome_on_launch: true,
        custom_openai_base_url: None,
    })
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    write_json(SETTINGS_FILE, settings)
}

pub fn load_providers() -> Vec<ProviderConfig> {
    read_json(PROVIDERS_FILE).unwrap_or_default()
}

pub fn save_provider(config: &ProviderConfig, api_key: Option<String>) -> Result<(), String> {
    let mut providers = load_providers();
    if let Some(index) = providers.iter().position(|entry| entry.id == config.id) {
        providers[index] = config.clone();
    } else {
        providers.push(config.clone());
    }

    if let Some(secret) = api_key {
        let entry = Entry::new(KEYRING_SERVICE, &config.id).map_err(|err| err.to_string())?;
        entry.set_password(&secret).map_err(|err| err.to_string())?;
    }

    write_json(PROVIDERS_FILE, &providers)
}

pub fn get_provider_secret(provider_id: &str) -> Option<String> {
    let entry = Entry::new(KEYRING_SERVICE, provider_id).ok()?;
    entry.get_password().ok()
}

pub fn get_recent_projects() -> Vec<RecentProject> {
    read_json(RECENTS_FILE).unwrap_or_default()
}

pub fn save_recent_project(path: &str) -> Result<(), String> {
    let mut projects = get_recent_projects();
    let name = PathBuf::from(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string();
    let now = format!("{}", chrono_like_now());

    if let Some(index) = projects.iter().position(|entry| entry.path == path) {
        projects[index].last_opened_at = now;
    } else {
        projects.insert(
            0,
            RecentProject {
                name,
                path: path.to_string(),
                last_opened_at: now,
            },
        );
    }

    projects.truncate(20);
    write_json(RECENTS_FILE, &projects)
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", timestamp)
}
```

FILE: apps/desktop/src-tauri/tauri.conf.json
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Antimatter",
  "version": "0.1.0",
  "identifier": "com.antimatter.ide",
  "build": {
    "beforeDevCommand": "npm run dev -w apps/desktop",
    "beforeBuildCommand": "npm run build -w apps/desktop",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "app": {
    "windows": [
      {
        "title": "Antimatter",
        "width": 1600,
        "height": 980,
        "minWidth": 1200,
        "minHeight": 760,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  }
}
```

FILE: apps/desktop/tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

FILE: apps/desktop/vite.config.ts
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 1420,
    strictPort: true
  },
  clearScreen: false
});
```

FILE: package.json
```json
{
  "name": "antimatter",
  "private": true,
  "version": "0.1.0",
  "description": "Antimatter — local-first, BYOK, agentic IDE built with Tauri, Rust, React, and TypeScript.",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w apps/desktop",
    "build": "npm run build -ws",
    "lint": "npm run lint -ws",
    "typecheck": "npm run typecheck -ws",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "prettier": "^3.3.3",
    "typescript": "^5.6.3"
  }
}
```

FILE: packages/agents/package.json
```json
{
  "name": "@antimatter/agents",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@antimatter/providers": "0.1.0",
    "@antimatter/shared": "0.1.0",
    "@antimatter/tools": "0.1.0"
  }
}
```

FILE: packages/agents/src/index.ts
```ts
import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { providerRegistry } from '@antimatter/providers';
import { builtInTools } from '@antimatter/tools';

export interface AgentRunContext {
  provider?: ProviderConfig;
  messages: AgentMessage[];
}

export interface AgentRunResult {
  reply: AgentMessage;
  logs: AgentActionLog[];
  approvalRequests: ApprovalRequest[];
}

export async function runSingleAgent(context: AgentRunContext): Promise<AgentRunResult> {
  const now = new Date().toISOString();
  const provider = context.provider;
  const logs: AgentActionLog[] = [
    {
      id: crypto.randomUUID(),
      kind: 'plan',
      title: 'Planned next step',
      detail: 'The agent reviewed the latest conversation and selected the next safe action.',
      createdAt: now
    },
    {
      id: crypto.randomUUID(),
      kind: 'info',
      title: 'Available tools',
      detail: builtInTools.map((tool) => `${tool.label} (${tool.risk})`).join(', '),
      createdAt: now
    }
  ];

  const content = provider
    ? await providerRegistry[provider.kind].createChat(
        {
          model: provider.model,
          messages: context.messages.map((message) => ({
            role: message.role === 'tool' ? 'assistant' : message.role,
            content: message.content
          }))
        },
        provider
      )
    : 'No provider is configured yet. Open Settings → Providers, add your API key or endpoint, choose a model, and try again.';

  return {
    reply: {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      createdAt: now
    },
    logs,
    approvalRequests: []
  };
}
```

FILE: packages/providers/package.json
```json
{
  "name": "@antimatter/providers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@antimatter/shared": "0.1.0"
  }
}
```

FILE: packages/providers/src/index.ts
```ts
import type { ProviderConfig, ProviderKind, ProviderTestResult } from '@antimatter/shared';

export interface ProviderContext {
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatRequest {
  model: string;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

export interface ProviderClient {
  kind: ProviderKind;
  label: string;
  testConnection(config: ProviderConfig, context?: ProviderContext): Promise<ProviderTestResult>;
  createChat(request: ChatRequest, config: ProviderConfig, context?: ProviderContext): Promise<string>;
}

class StubProviderClient implements ProviderClient {
  constructor(public kind: ProviderKind, public label: string) {}

  async testConnection(config: ProviderConfig): Promise<ProviderTestResult> {
    if (!config.model) {
      return { ok: false, message: 'Choose a default model before testing the provider.' };
    }
    return {
      ok: true,
      message: `${this.label} configuration looks structurally valid. Replace this stub with a live API probe for production use.`
    };
  }

  async createChat(request: ChatRequest, config: ProviderConfig): Promise<string> {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    return [
      `Provider: ${this.label}`,
      `Model: ${config.model}`,
      '',
      'This starter uses a provider abstraction with conservative stub implementations.',
      'Wire the concrete HTTP client for your chosen provider here.',
      '',
      `Echo: ${lastMessage}`
    ].join('\n');
  }
}

export const providerRegistry: Record<ProviderKind, ProviderClient> = {
  openai: new StubProviderClient('openai', 'OpenAI'),
  anthropic: new StubProviderClient('anthropic', 'Anthropic'),
  gemini: new StubProviderClient('gemini', 'Gemini'),
  local: new StubProviderClient('local', 'Local Endpoint'),
  'openai-compatible': new StubProviderClient('openai-compatible', 'OpenAI-Compatible Endpoint')
};

export const providerDefaults: Array<Pick<ProviderConfig, 'label' | 'kind' | 'model' | 'notes'>> = [
  {
    label: 'OpenAI',
    kind: 'openai',
    model: 'gpt-4.1-mini',
    notes: 'Use your own OpenAI API key. Latency and pricing depend on your OpenAI account and model choice.'
  },
  {
    label: 'Anthropic',
    kind: 'anthropic',
    model: 'claude-3-7-sonnet-latest',
    notes: 'Bring your own Anthropic key. Model availability depends on your Anthropic account.'
  },
  {
    label: 'Gemini',
    kind: 'gemini',
    model: 'gemini-2.5-pro',
    notes: 'Connect your own Gemini API credentials.'
  },
  {
    label: 'Local Endpoint',
    kind: 'local',
    model: 'your-local-model',
    notes: 'Antimatter does not ship a model. Point this at an endpoint you already run locally or self-host.'
  },
  {
    label: 'Custom OpenAI-Compatible',
    kind: 'openai-compatible',
    model: 'compatible-model',
    notes: 'Use any compatible base URL. Performance depends on the remote or self-hosted endpoint.'
  }
];
```

FILE: packages/shared/package.json
```json
{
  "name": "@antimatter/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

FILE: packages/shared/src/index.ts
```ts
export type ThemeMode = 'dark' | 'light';
export type AgentDockSide = 'left' | 'right';
export type BottomPanelTab = 'terminal' | 'problems' | 'output';
export type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'local'
  | 'openai-compatible';

export interface WorkspaceEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  language: string;
  content: string;
  dirty?: boolean;
}

export interface RecentProject {
  name: string;
  path: string;
  lastOpenedAt: string;
}

export interface ProviderConfig {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl?: string;
  model: string;
  apiKeyStored: boolean;
  status: 'unknown' | 'connected' | 'failed';
  notes?: string;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
}

export interface AgentActionLog {
  id: string;
  kind: 'plan' | 'tool' | 'approval' | 'info' | 'error';
  title: string;
  detail: string;
  createdAt: string;
}

export interface DiffPreview {
  filePath: string;
  original: string;
  proposed: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  diff?: DiffPreview;
}

export interface AppSettings {
  theme: ThemeMode;
  agentDockSide: AgentDockSide;
  defaultProviderId?: string;
  telemetryEnabled: boolean;
  showWelcomeOnLaunch: boolean;
  customOpenAIBaseUrl?: string;
}

export interface SearchResult {
  filePath: string;
  line: number;
  preview: string;
}

export interface TerminalRequest {
  cwd: string;
  command: string;
}

export interface TerminalResponse {
  allowed: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  message?: string;
}

export const APP_NAME = 'Antimatter';
export const APP_TAGLINE = 'A local-first agentic IDE for developers who want leverage without lock-in.';
```

FILE: packages/tools/package.json
```json
{
  "name": "@antimatter/tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@antimatter/shared": "0.1.0"
  }
}
```

FILE: packages/tools/src/index.ts
```ts
export type ToolRisk = 'read-only' | 'approval-required' | 'guarded';

export interface ToolDescriptor {
  id: string;
  label: string;
  description: string;
  risk: ToolRisk;
}

export const builtInTools: ToolDescriptor[] = [
  {
    id: 'read-file',
    label: 'Read File',
    description: 'Read a file from the current workspace.',
    risk: 'read-only'
  },
  {
    id: 'write-file',
    label: 'Write File',
    description: 'Write a full file after diff preview and approval.',
    risk: 'approval-required'
  },
  {
    id: 'patch-file',
    label: 'Patch File',
    description: 'Apply a targeted patch to a file after diff preview and approval.',
    risk: 'approval-required'
  },
  {
    id: 'search-workspace',
    label: 'Search Workspace',
    description: 'Search for text across the opened workspace.',
    risk: 'read-only'
  },
  {
    id: 'terminal-exec',
    label: 'Terminal Execution',
    description: 'Run a terminal command through a guarded execution policy.',
    risk: 'guarded'
  }
];
```

FILE: packages/ui/package.json
```json
{
  "name": "@antimatter/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts"
}
```

FILE: packages/ui/src/index.ts
```ts
export const elevation = {
  panel: '0 8px 32px rgba(0, 0, 0, 0.18)',
  floating: '0 16px 48px rgba(0, 0, 0, 0.22)'
};

export const radii = {
  panel: '18px',
  control: '12px'
};
```

FILE: tsconfig.base.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@antimatter/shared": ["packages/shared/src"],
      "@antimatter/providers": ["packages/providers/src"],
      "@antimatter/agents": ["packages/agents/src"],
      "@antimatter/tools": ["packages/tools/src"],
      "@antimatter/ui": ["packages/ui/src"]
    }
  }
}
```

