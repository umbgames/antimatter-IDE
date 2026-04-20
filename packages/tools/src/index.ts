export type ToolRisk = 'read-only' | 'approval-required' | 'guarded';

export interface ToolDescriptor {
  id: string;
  label: string;
  description: string;
  risk: ToolRisk;
  schema?: string; // JSON schema hint for the LLM
}

export const builtInTools: ToolDescriptor[] = [
  // ─── File I/O ───
  {
    id: 'read-file',
    label: 'Read File',
    description: 'Read a file from the workspace. Returns the full text content.',
    risk: 'read-only',
    schema: '{"path": "relative/or/absolute/path"}'
  },
  {
    id: 'write-file',
    label: 'Write File',
    description: 'Create or overwrite a file with the given content. Parent directories are created automatically.',
    risk: 'read-only',
    schema: '{"path": "file/path", "content": "full file content"}'
  },
  {
    id: 'patch-file',
    label: 'Patch File',
    description: 'Apply targeted search-and-replace edits to an existing file. Each replacement finds the exact text and replaces it.',
    risk: 'read-only',
    schema: '{"path": "file/path", "replacements": [{"search": "exact old text", "replace": "new text"}]}'
  },
  {
    id: 'replace-lines',
    label: 'Replace Lines',
    description: 'Replace a specific range of lines in a file. Lines are 1-indexed. Use this for surgical edits without rewriting the entire file.',
    risk: 'read-only',
    schema: '{"path": "file/path", "start_line": 10, "end_line": 15, "replacement": "new code here"}'
  },
  {
    id: 'delete-file',
    label: 'Delete File',
    description: 'Delete a file or empty directory from the workspace.',
    risk: 'read-only',
    schema: '{"path": "file/path"}'
  },
  {
    id: 'rename-file',
    label: 'Rename / Move File',
    description: 'Rename or move a file from one path to another. Creates destination directories automatically.',
    risk: 'read-only',
    schema: '{"from": "old/path", "to": "new/path"}'
  },

  // ─── Directory Operations ───
  {
    id: 'list-directory',
    label: 'List Directory',
    description: 'List all files and subdirectories in a directory. Returns names, types, and sizes. Use recursive=true to walk subdirectories.',
    risk: 'read-only',
    schema: '{"path": "dir/path", "recursive": false, "maxDepth": 3}'
  },
  {
    id: 'create-directory',
    label: 'Create Directory',
    description: 'Create a directory (and any missing parent directories).',
    risk: 'read-only',
    schema: '{"path": "dir/path"}'
  },

  // ─── Search ───
  {
    id: 'search-workspace',
    label: 'Search Workspace',
    description: 'Search for text across all files in the workspace. Returns matching file paths, line numbers, and previews.',
    risk: 'read-only',
    schema: '{"query": "search text"}'
  },
  {
    id: 'grep-search',
    label: 'Grep Search',
    description: 'Search files using a regex pattern. Optionally filter by file extension. Returns matches with context.',
    risk: 'read-only',
    schema: '{"pattern": "regex pattern", "include": "*.ts", "path": "optional/subdir"}'
  },
  {
    id: 'query-codebase',
    label: 'Semantic Code Search',
    description: 'Perform a semantic/meaning-based search across indexed code. Best for finding code by concept rather than exact text.',
    risk: 'read-only',
    schema: '{"query": "describe what you are looking for"}'
  },

  // ─── Terminal ───
  {
    id: 'terminal-exec',
    label: 'Run Terminal Command',
    description: 'Execute a shell command in the workspace directory. Use for: installing packages, running builds, running tests, git operations, or any CLI task. Commands run in PowerShell on Windows, sh on Linux/Mac.',
    risk: 'read-only',
    schema: '{"command": "npm install express"}'
  },

  // ─── Analysis ───
  {
    id: 'analyze-file',
    label: 'Analyze File',
    description: 'Analyze a source file for structure, complexity, issues, and suggestions. Returns: exports, imports, functions, classes, line count, TODO/FIXME comments, and potential issues.',
    risk: 'read-only',
    schema: '{"path": "file/path"}'
  },
  {
    id: 'analyze-dependencies',
    label: 'Analyze Dependencies',
    description: 'Analyze project dependencies from package.json, Cargo.toml, or requirements.txt. Shows outdated, unused, and security-flagged packages.',
    risk: 'read-only',
    schema: '{"path": "optional/path/to/manifest"}'
  },
  {
    id: 'analyze-project',
    label: 'Analyze Project Structure',
    description: 'Get a high-level overview of the project: directory tree, language breakdown, file count, total lines of code, and detected frameworks.',
    risk: 'read-only',
    schema: '{}'
  },

  // ─── Web / Fetch ───
  {
    id: 'fetch-url',
    label: 'Fetch URL',
    description: 'Fetch content from a URL. Useful for reading documentation, APIs, or downloading files. Returns text content (HTML is stripped to plain text).',
    risk: 'read-only',
    schema: '{"url": "https://example.com/docs"}'
  },

  // ─── File Info ───
  {
    id: 'get-file-info',
    label: 'Get File Info',
    description: 'Get metadata about a file: size, modification date, permissions, line count, and detected language.',
    risk: 'read-only',
    schema: '{"path": "file/path"}'
  },

  // ─── Bulk Operations ───
  {
    id: 'bulk-replace',
    label: 'Bulk Find & Replace',
    description: 'Find and replace text across multiple files in the workspace. Supports regex. Returns a summary of all changes made.',
    risk: 'read-only',
    schema: '{"search": "old text or /regex/", "replace": "new text", "include": "*.ts", "path": "optional/subdir"}'
  },
];

/**
 * Convert builtInTools into the OpenAI function calling format.
 * This lets models with native tool calling (e.g. openai/gpt-oss-120b)
 * use their trained function-calling behavior.
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
    // Parse the schema string into JSON Schema properties
    let properties: Record<string, any> = {};
    let required: string[] = [];

    if (tool.schema) {
      try {
        const example = JSON.parse(tool.schema);
        for (const [key, value] of Object.entries(example)) {
          if (Array.isArray(value)) {
            properties[key] = {
              type: 'array',
              description: `Parameter: ${key}`,
              items: { type: 'object' }
            };
            // Arrays with content are likely required
            required.push(key);
          } else if (typeof value === 'boolean') {
            properties[key] = { type: 'boolean', description: `Parameter: ${key}` };
          } else if (typeof value === 'number') {
            properties[key] = { type: 'integer', description: `Parameter: ${key}` };
          } else if (typeof value === 'object' && value !== null) {
            properties[key] = { type: 'object', description: `Parameter: ${key}` };
          } else {
            properties[key] = { type: 'string', description: `Parameter: ${key}` };
            // String params with real-looking example values are likely required
            if (typeof value === 'string' && !value.startsWith('optional')) {
              required.push(key);
            }
          }
        }
      } catch {
        // If schema parsing fails, use a permissive schema
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
