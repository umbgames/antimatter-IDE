export type ToolRisk = 'read-only' | 'approval-required' | 'guarded';

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: Record<string, any>;
  default?: any;
}

export interface ToolDescriptor {
  id: string;
  label: string;
  description: string;
  risk: ToolRisk;
  schema?: string; // Legacy: JSON schema hint for the LLM
  parameters?: Record<string, ToolParameter>;
  required?: string[];
}

export const builtInTools: ToolDescriptor[] = [
  // ─── File I/O ───
  {
    id: 'read-file',
    label: 'Read File',
    description: 'Read a file from the workspace. For large files (>400 lines), use start_line/end_line to paginate. Always prefer reading specific line ranges over full files in large repos.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the file to read' },
      start_line: { type: 'integer', description: 'First line to read (1-indexed). Omit to start from line 1.' },
      end_line: { type: 'integer', description: 'Last line to read (1-indexed). Omit to read to end of file.' }
    },
    required: ['path']
  },
  {
    id: 'read-files',
    label: 'Read Multiple Files',
    description: 'Read multiple files in a single call. Much more efficient than calling read-file multiple times. Returns a map of path → content. Files that fail to read are returned with error messages.',
    risk: 'read-only',
    parameters: {
      paths: { type: 'array', description: 'Array of absolute file paths to read', items: { type: 'string' } },
      max_lines: { type: 'integer', description: 'Maximum lines per file (default: 300). Files exceeding this are truncated with a notice.' }
    },
    required: ['paths']
  },
  {
    id: 'write-file',
    label: 'Write File',
    description: 'Create or overwrite a file with the given content. Parent directories are created automatically. Use patch-file instead for targeted edits to avoid rewriting entire files.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the file to create/overwrite' },
      content: { type: 'string', description: 'Full file content to write' }
    },
    required: ['path', 'content']
  },
  {
    id: 'patch-file',
    label: 'Patch File',
    description: 'Apply targeted search-and-replace edits to an existing file. Each replacement finds the EXACT text and replaces it. Preferred over write-file for modifying existing code — safer, faster, and uses less context.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the file to patch' },
      replacements: { type: 'array', description: 'Array of {search, replace} objects. "search" must match exactly.', items: { type: 'object' } }
    },
    required: ['path', 'replacements']
  },
  {
    id: 'replace-lines',
    label: 'Replace Lines',
    description: 'Replace a specific range of lines in a file by line number. Lines are 1-indexed. Best for surgical edits when you know the exact line numbers from a previous read-file or analyze-file call.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the file' },
      start_line: { type: 'integer', description: 'First line to replace (1-indexed)' },
      end_line: { type: 'integer', description: 'Last line to replace (1-indexed, inclusive)' },
      replacement: { type: 'string', description: 'New content to insert in place of the specified lines' }
    },
    required: ['path', 'start_line', 'replacement']
  },
  {
    id: 'delete-file',
    label: 'Delete File',
    description: 'Delete a file or empty directory from the workspace.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the file or directory to delete' }
    },
    required: ['path']
  },
  {
    id: 'rename-file',
    label: 'Rename / Move File',
    description: 'Rename or move a file from one path to another. Creates destination directories automatically.',
    risk: 'read-only',
    parameters: {
      from: { type: 'string', description: 'Current absolute path' },
      to: { type: 'string', description: 'New absolute path' }
    },
    required: ['from', 'to']
  },

  // ─── Directory Operations ───
  {
    id: 'list-directory',
    label: 'List Directory',
    description: 'List all files and subdirectories in a directory. Use recursive=true to walk subdirectories. For large repos, limit maxDepth to 2-3.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the directory' },
      recursive: { type: 'boolean', description: 'Walk subdirectories recursively (default: false)' },
      maxDepth: { type: 'integer', description: 'Maximum directory depth when recursive=true (default: 3)' }
    },
    required: ['path']
  },
  {
    id: 'create-directory',
    label: 'Create Directory',
    description: 'Create a directory (and any missing parent directories).',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path for the new directory' }
    },
    required: ['path']
  },

  // ─── Search ───
  {
    id: 'search-workspace',
    label: 'Search Workspace',
    description: 'Full-text search across all files in the workspace. Returns matching file paths, line numbers, and previews. Max 100 results.',
    risk: 'read-only',
    parameters: {
      query: { type: 'string', description: 'Text to search for (case-insensitive)' }
    },
    required: ['query']
  },
  {
    id: 'grep-search',
    label: 'Grep Search',
    description: 'Search files using a regex pattern. More powerful than search-workspace. Supports file extension filtering and subdirectory scoping. Returns matches with surrounding context.',
    risk: 'read-only',
    parameters: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      include: { type: 'string', description: 'File extension filter, e.g. "*.ts" or "*.rs"' },
      path: { type: 'string', description: 'Optional subdirectory to scope the search to (relative to workspace root)' }
    },
    required: ['pattern']
  },
  {
    id: 'query-codebase',
    label: 'Semantic Code Search',
    description: 'Perform a semantic/meaning-based search across indexed code. Best for finding code by concept (e.g. "authentication middleware") rather than exact text. Requires workspace to be indexed.',
    risk: 'read-only',
    parameters: {
      query: { type: 'string', description: 'Natural language description of what you are looking for' }
    },
    required: ['query']
  },
  {
    id: 'find-symbols',
    label: 'Find Symbols',
    description: 'Search for function, class, struct, interface, or type definitions across the workspace. Faster and more precise than grep-search for finding code symbols. Returns file path, line number, and symbol signature.',
    risk: 'read-only',
    parameters: {
      name: { type: 'string', description: 'Symbol name or partial name to search for (case-insensitive)' },
      kind: { type: 'string', description: 'Filter by symbol kind', enum: ['function', 'class', 'struct', 'interface', 'type', 'enum', 'const', 'all'] },
      include: { type: 'string', description: 'File extension filter, e.g. "*.ts"' }
    },
    required: ['name']
  },

  // ─── Terminal ───
  {
    id: 'terminal-exec',
    label: 'Run Terminal Command',
    description: 'Execute a shell command in the workspace directory and wait for it to complete. Use for: installing packages, running builds, running tests, git operations, or any CLI task. Commands run in PowerShell on Windows, sh on Linux/Mac. Timeout: 60s.',
    risk: 'read-only',
    parameters: {
      command: { type: 'string', description: 'Shell command to execute' }
    },
    required: ['command']
  },
  {
    id: 'run-background-command',
    label: 'Run Background Command',
    description: 'Execute a long-running shell command in the background (like dev servers, watch modes). Returns a jobId immediately. Use check-command to poll status and output.',
    risk: 'read-only',
    parameters: {
      command: { type: 'string', description: 'Shell command to run in the background' }
    },
    required: ['command']
  },
  {
    id: 'check-command',
    label: 'Check Command Status',
    description: 'Check the status (running/done/error) and recent output of a background command started with run-background-command.',
    risk: 'read-only',
    parameters: {
      jobId: { type: 'string', description: 'The job ID returned by run-background-command' }
    },
    required: ['jobId']
  },
  {
    id: 'read-console',
    label: 'Read Console',
    description: 'Read the recent output of the main user-facing terminal console. Useful for checking the status of user-initiated commands or running servers.',
    risk: 'read-only',
    parameters: {},
    required: []
  },

  // ─── Analysis ───
  {
    id: 'analyze-file',
    label: 'Analyze File',
    description: 'Analyze a source file for structure: exports, imports, functions, classes, line count, TODO/FIXME comments, and potential issues. Much cheaper than read-file for understanding file structure.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the file to analyze' }
    },
    required: ['path']
  },
  {
    id: 'analyze-dependencies',
    label: 'Analyze Dependencies',
    description: 'Analyze project dependencies from package.json, Cargo.toml, or requirements.txt. Lists all dependencies with versions and categories.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Optional path to a specific manifest file. If omitted, auto-detects in workspace root.' }
    },
    required: []
  },
  {
    id: 'analyze-project',
    label: 'Analyze Project Structure',
    description: 'Get a high-level overview of the project: directory tree, language breakdown, file count, total lines of code, and detected frameworks. Call this first when working on unfamiliar repos.',
    risk: 'read-only',
    parameters: {},
    required: []
  },

  // ─── Agent Ops ───
  {
    id: 'delegate-task',
    label: 'Delegate Task',
    description: 'Delegate a specific sub-task to a specialized sub-agent. The sub-agent runs independently with its own tool access and returns a final report. Best for parallelizable tasks like "write tests for X" or "review file Y".',
    risk: 'read-only',
    parameters: {
      persona: { type: 'string', description: 'Sub-agent persona', enum: ['engineer', 'architect', 'qa'] },
      task: { type: 'string', description: 'Detailed task description for the sub-agent' }
    },
    required: ['persona', 'task']
  },
  {
    id: 'capture-screen',
    label: 'Capture Screen',
    description: 'Take a screenshot of the user\'s primary display. Useful for visual debugging, checking UI layout, or reading error dialogs. Returns a base64 PNG.',
    risk: 'read-only',
    parameters: {},
    required: []
  },

  // ─── Web / Fetch ───
  {
    id: 'fetch-url',
    label: 'Fetch URL',
    description: 'Fetch content from a URL. Useful for reading documentation, API references, or downloading configuration files. HTML is auto-converted to plain text.',
    risk: 'read-only',
    parameters: {
      url: { type: 'string', description: 'URL to fetch content from' }
    },
    required: ['url']
  },

  // ─── File Info ───
  {
    id: 'get-file-info',
    label: 'Get File Info',
    description: 'Get metadata about a file: size, modification date, line count, and detected language. Cheaper than read-file when you just need to check if a file exists or how large it is.',
    risk: 'read-only',
    parameters: {
      path: { type: 'string', description: 'Absolute path to the file' }
    },
    required: ['path']
  },

  // ─── Bulk Operations ───
  {
    id: 'bulk-replace',
    label: 'Bulk Find & Replace',
    description: 'Find and replace text across multiple files in the workspace. Supports regex patterns and file extension filtering. Returns a summary of all changes made.',
    risk: 'read-only',
    parameters: {
      search: { type: 'string', description: 'Text or regex pattern to find' },
      replace: { type: 'string', description: 'Replacement text' },
      include: { type: 'string', description: 'File extension filter, e.g. "*.ts"' },
      path: { type: 'string', description: 'Optional subdirectory to scope the operation' }
    },
    required: ['search', 'replace']
  },
];

/**
 * Convert builtInTools into the OpenAI function calling format.
 * Uses proper JSON Schema with typed parameters, descriptions, and enums.
 */
export function toOpenAITools(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}> {
  return builtInTools.map(tool => {
    let properties: Record<string, any> = {};
    let required: string[] = tool.required || [];

    if (tool.parameters) {
      // Use the new structured parameter definitions
      for (const [key, param] of Object.entries(tool.parameters)) {
        const prop: Record<string, any> = {
          type: param.type,
          description: param.description,
        };
        if (param.enum) prop.enum = param.enum;
        if (param.items) prop.items = param.items;
        if (param.default !== undefined) prop.default = param.default;
        properties[key] = prop;
      }
    } else if (tool.schema) {
      // Legacy fallback: parse the schema string
      try {
        const example = JSON.parse(tool.schema);
        for (const [key, value] of Object.entries(example)) {
          if (Array.isArray(value)) {
            properties[key] = {
              type: 'array',
              description: `Parameter: ${key}`,
              items: { type: 'object' }
            };
            required.push(key);
          } else if (typeof value === 'boolean') {
            properties[key] = { type: 'boolean', description: `Parameter: ${key}` };
          } else if (typeof value === 'number') {
            properties[key] = { type: 'integer', description: `Parameter: ${key}` };
          } else if (typeof value === 'object' && value !== null) {
            properties[key] = { type: 'object', description: `Parameter: ${key}` };
          } else {
            properties[key] = { type: 'string', description: `Parameter: ${key}` };
            if (typeof value === 'string' && !value.startsWith('optional')) {
              required.push(key);
            }
          }
        }
      } catch {
        properties = { args: { type: 'object', description: 'Tool arguments' } };
      }
    }

    return {
      type: 'function' as const,
      function: {
        name: tool.id,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required,
        }
      }
    };
  });
}
