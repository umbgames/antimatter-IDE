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
    description: 'Apply a targeted patch to a file using {"path": "...", "replacements": [{"search": "exact string", "replace": "new string"}]}.',
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
  },
  {
    id: 'query-codebase',
    label: 'Query Codebase',
    description: 'Perform a semantic search across the codebase using local embeddings to find relevant code snippets.',
    risk: 'read-only'
  }
];
