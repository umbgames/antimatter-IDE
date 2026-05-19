// ─── Learner Engine ───
// Core service for Learner Mode: syntax-aware tokenization, in-memory session cache,
// progressive token-by-token reveal, and typing validation.
// 
// Design: The AI generates the FULL implementation ONCE. This engine caches it in RAM,
// tokenizes it with syntax awareness, and reveals tokens progressively as the user types.
// This is NOT autocomplete — it's a guided learning experience.

import { chatWithProvider, type RuntimeChatMessage } from '@/lib/tauri';

// ─── Types ───

export interface LearnerSession {
  fileId: string;
  fileName: string;
  fullCode: string;
  tokens: string[];
  currentTokenIndex: number;
  active: boolean;
  /** Tracks how many characters of the current token the user has typed */
  currentTokenProgress: number;
  /** Timestamp for GC and diagnostics */
  createdAt: number;
  /** Whether generation is still in progress */
  generating: boolean;
  /** Error message if generation failed */
  error?: string;
}

export type LearnerStatus = 'idle' | 'generating' | 'active' | 'completed' | 'error';

// ─── Syntax-Aware Tokenizer ───

/**
 * Tokenizes source code into syntax-aware tokens preserving all whitespace,
 * punctuation, and structure. This is critical for the learner experience
 * to teach syntax naturally.
 * 
 * Example:
 *   "import React, { useState } from 'react';"
 *   → ["import", " ", "React", ",", " ", "{", " ", "useState", " ", "}", " ", "from", " ", "'react'", ";", "\n"]
 */
export function tokenizeCode(code: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < code.length) {
    const ch = code[i];

    // ─── Newlines (preserve as individual tokens) ───
    if (ch === '\n') {
      tokens.push('\n');
      i++;
      continue;
    }
    if (ch === '\r') {
      if (code[i + 1] === '\n') {
        tokens.push('\n');
        i += 2;
      } else {
        tokens.push('\n');
        i++;
      }
      continue;
    }

    // ─── Whitespace runs (spaces/tabs only, not newlines) ───
    if (ch === ' ' || ch === '\t') {
      let ws = '';
      while (i < code.length && (code[i] === ' ' || code[i] === '\t')) {
        ws += code[i];
        i++;
      }
      tokens.push(ws);
      continue;
    }

    // ─── String literals (single, double, backtick) ───
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let str = ch;
      i++;
      while (i < code.length) {
        if (code[i] === '\\' && i + 1 < code.length) {
          str += code[i] + code[i + 1];
          i += 2;
          continue;
        }
        if (code[i] === quote) {
          str += code[i];
          i++;
          break;
        }
        // Template literal newlines — break string token at newline
        if (quote === '`' && code[i] === '\n') {
          break;
        }
        str += code[i];
        i++;
      }
      tokens.push(str);
      continue;
    }

    // ─── Line comments ───
    if (ch === '/' && code[i + 1] === '/') {
      let comment = '';
      while (i < code.length && code[i] !== '\n') {
        comment += code[i];
        i++;
      }
      tokens.push(comment);
      continue;
    }

    // ─── Block comments ───
    if (ch === '/' && code[i + 1] === '*') {
      let comment = '/*';
      i += 2;
      while (i < code.length) {
        if (code[i] === '*' && code[i + 1] === '/') {
          comment += '*/';
          i += 2;
          break;
        }
        comment += code[i];
        i++;
      }
      tokens.push(comment);
      continue;
    }

    // ─── Multi-character operators ───
    const threeChar = code.slice(i, i + 3);
    if (['===', '!==', '>>>', '<<=', '>>=', '...', '**=', '&&=', '||=', '??='].includes(threeChar)) {
      tokens.push(threeChar);
      i += 3;
      continue;
    }

    const twoChar = code.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '??', '=>', '++', '--', '+=', '-=', '*=', '/=', '%=', '**', '<<', '>>', '?.', '::'].includes(twoChar)) {
      tokens.push(twoChar);
      i += 2;
      continue;
    }

    // ─── Single-character punctuation ───
    if ('(){}[]<>;:,.=+-*/%!&|^~?@#'.includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }

    // ─── Identifiers / keywords / numbers ───
    if (/[a-zA-Z_$0-9]/.test(ch)) {
      let word = '';
      while (i < code.length && /[a-zA-Z_$0-9]/.test(code[i])) {
        word += code[i];
        i++;
      }
      tokens.push(word);
      continue;
    }

    // ─── Any other character ───
    tokens.push(ch);
    i++;
  }

  return tokens;
}

// ─── Typing Validation ───

/**
 * Compares user input against the expected token with mild typo tolerance.
 * Returns a validation result.
 */
export function validateTyping(
  expected: string,
  typed: string,
  progress: number
): { valid: boolean; complete: boolean; remaining: string; mismatch: boolean } {
  // The portion of the expected token we're checking against
  const expectedSoFar = expected.slice(0, progress + typed.length);
  const fullTyped = expected.slice(0, progress) + typed;

  // Check if the typed text is a valid prefix
  if (expectedSoFar.startsWith(fullTyped) || fullTyped === expectedSoFar) {
    const newProgress = fullTyped.length;
    const complete = newProgress >= expected.length;
    const remaining = expected.slice(newProgress);
    return { valid: true, complete, remaining, mismatch: false };
  }

  // ─── Mild typo tolerance ───
  // Allow up to 1 character difference (Levenshtein distance = 1)
  const dist = simpleLevenshtein(fullTyped, expectedSoFar);
  if (dist <= 1 && fullTyped.length <= expected.length) {
    return { valid: true, complete: false, remaining: expected.slice(fullTyped.length), mismatch: true };
  }

  return { valid: false, complete: false, remaining: expected.slice(progress), mismatch: true };
}

/** Simple Levenshtein distance for short strings (used for typo tolerance) */
function simpleLevenshtein(a: string, b: string): number {
  if (a.length > 20 || b.length > 20) {
    // For long strings, just check prefix match
    return a === b ? 0 : 2;
  }
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// ─── Intent Inference ───

/**
 * Infers the likely implementation intent from filename, extension, and project context.
 * Builds a detailed prompt for the AI to generate the full file.
 */
function buildGenerationPrompt(
  fileName: string,
  workspacePath?: string,
  nearbyFiles?: string[]
): RuntimeChatMessage[] {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const baseName = fileName.replace(/\.[^.]+$/, '');

  // Infer framework/patterns from extension
  let frameworkHint = '';
  if (['tsx', 'jsx'].includes(ext)) {
    frameworkHint = 'This is likely a React component. Use modern React patterns (hooks, functional components).';
  } else if (ext === 'ts' && baseName.includes('service')) {
    frameworkHint = 'This is likely a TypeScript service class/module.';
  } else if (ext === 'ts' && baseName.includes('store')) {
    frameworkHint = 'This is likely a state management store (Zustand, Redux, etc).';
  } else if (ext === 'ts' && (baseName.includes('hook') || baseName.startsWith('use'))) {
    frameworkHint = 'This is likely a custom React hook.';
  } else if (ext === 'ts' && baseName.includes('util')) {
    frameworkHint = 'This is likely a utility/helper module.';
  } else if (ext === 'rs') {
    frameworkHint = 'This is a Rust source file.';
  } else if (ext === 'py') {
    frameworkHint = 'This is a Python source file.';
  } else if (ext === 'css') {
    frameworkHint = 'This is a CSS stylesheet.';
  }

  // Infer purpose from filename
  let purposeHint = '';
  const lowerBase = baseName.toLowerCase().replace(/[-_]/g, ' ');
  if (lowerBase.includes('calculator')) purposeHint = 'A calculator application/component.';
  else if (lowerBase.includes('login') || lowerBase.includes('auth')) purposeHint = 'An authentication/login interface.';
  else if (lowerBase.includes('dashboard')) purposeHint = 'A dashboard view/component.';
  else if (lowerBase.includes('todo')) purposeHint = 'A todo list application.';
  else if (lowerBase.includes('api') || lowerBase.includes('client')) purposeHint = 'An API client/abstraction layer.';
  else if (lowerBase.includes('form')) purposeHint = 'A form component.';
  else if (lowerBase.includes('table') || lowerBase.includes('list')) purposeHint = 'A data display component (table/list).';
  else if (lowerBase.includes('nav') || lowerBase.includes('sidebar')) purposeHint = 'A navigation/sidebar component.';
  else if (lowerBase.includes('modal') || lowerBase.includes('dialog')) purposeHint = 'A modal/dialog component.';
  else if (lowerBase.includes('chart') || lowerBase.includes('graph')) purposeHint = 'A chart/visualization component.';
  else purposeHint = `A module named "${baseName}" — infer the purpose from the name.`;

  let projectContext = '';
  if (nearbyFiles && nearbyFiles.length > 0) {
    projectContext = `\n\nNearby files in the project:\n${nearbyFiles.slice(0, 20).map(f => `- ${f}`).join('\n')}`;
  }

  const systemPrompt = `You are a code generation engine for a learning IDE feature called "Learner Mode".
Your task is to generate a COMPLETE, production-quality implementation for a file based on its name and context.

RULES:
1. Generate ONLY the code — no markdown fences, no explanations, no comments like "// your code here"
2. The code must be immediately runnable/compilable
3. Use modern best practices for the language/framework
4. Include proper imports, types, and exports
5. Generate a realistic, practical implementation — not a skeleton
6. The implementation should be educational and demonstrate good patterns
7. Keep the implementation focused but complete (50-150 lines ideal)
8. Do NOT wrap in markdown code blocks — output raw code only`;

  const userPrompt = `Generate the complete implementation for: ${fileName}

File extension: .${ext}
${frameworkHint}
Purpose: ${purposeHint}
${projectContext}

Generate the full, working implementation now. Output ONLY the raw code.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

// ─── Learner Engine (Singleton) ───

class LearnerEngineImpl {
  private sessions: Map<string, LearnerSession> = new Map();
  private listeners: Set<() => void> = new Set();

  // ─── Session Management ───

  /** Start a learner session for a file. Generates the full implementation via AI. */
  async startSession(
    fileId: string,
    fileName: string,
    providerId: string,
    workspacePath?: string,
    nearbyFiles?: string[]
  ): Promise<void> {
    // Avoid duplicate sessions
    if (this.sessions.has(fileId)) {
      const existing = this.sessions.get(fileId)!;
      if (existing.generating || existing.active) return;
    }

    // Create placeholder session
    const session: LearnerSession = {
      fileId,
      fileName,
      fullCode: '',
      tokens: [],
      currentTokenIndex: 0,
      currentTokenProgress: 0,
      active: false,
      generating: true,
      createdAt: Date.now()
    };

    this.sessions.set(fileId, session);
    this.notify();

    try {
      const messages = buildGenerationPrompt(fileName, workspacePath, nearbyFiles);
      const response = await chatWithProvider(providerId, messages);

      let code = response.content?.trim() ?? '';
      
      // Strip markdown code fences if the model added them
      if (code.startsWith('```')) {
        const firstNewline = code.indexOf('\n');
        code = code.slice(firstNewline + 1);
        if (code.endsWith('```')) {
          code = code.slice(0, -3).trimEnd();
        }
      }

      if (!code) {
        session.error = 'AI returned empty response';
        session.generating = false;
        this.notify();
        return;
      }

      // Tokenize and activate
      const tokens = tokenizeCode(code);
      session.fullCode = code;
      session.tokens = tokens;
      session.active = true;
      session.generating = false;
      this.notify();

    } catch (err: any) {
      session.error = err?.message || 'Generation failed';
      session.generating = false;
      this.notify();
    }
  }

  /** Get the current session for a file */
  getSession(fileId: string): LearnerSession | undefined {
    return this.sessions.get(fileId);
  }

  /** Get the status of a learner session */
  getStatus(fileId: string): LearnerStatus {
    const session = this.sessions.get(fileId);
    if (!session) return 'idle';
    if (session.error) return 'error';
    if (session.generating) return 'generating';
    if (session.active) return 'active';
    return 'completed';
  }

  /** Get the current ghost text (next expected token) for the active session */
  getGhostText(fileId: string): string | null {
    const session = this.sessions.get(fileId);
    if (!session || !session.active || session.currentTokenIndex >= session.tokens.length) {
      return null;
    }

    const currentToken = session.tokens[session.currentTokenIndex];
    const remaining = currentToken.slice(session.currentTokenProgress);
    return remaining || null;
  }

  /** Get the full remaining ghost text from the current position (for context) */
  getFullRemainingText(fileId: string): string | null {
    const session = this.sessions.get(fileId);
    if (!session || !session.active) return null;

    const currentTokenRemaining = session.tokens[session.currentTokenIndex]?.slice(session.currentTokenProgress) ?? '';
    const futureTokens = session.tokens.slice(session.currentTokenIndex + 1).join('');
    const full = currentTokenRemaining + futureTokens;
    return full || null;
  }

  /** Get the text that has been "completed" so far */
  getCompletedText(fileId: string): string {
    const session = this.sessions.get(fileId);
    if (!session) return '';

    const completedTokens = session.tokens.slice(0, session.currentTokenIndex).join('');
    const partialCurrent = session.tokens[session.currentTokenIndex]?.slice(0, session.currentTokenProgress) ?? '';
    return completedTokens + partialCurrent;
  }

  /** Get progress as percentage */
  getProgress(fileId: string): number {
    const session = this.sessions.get(fileId);
    if (!session || session.tokens.length === 0) return 0;
    return Math.round((session.currentTokenIndex / session.tokens.length) * 100);
  }

  // ─── Typing Input Processing ───

  /**
   * Process user input and advance the learner state.
   * Returns true if the input was valid (matched or close match).
   */
  processInput(fileId: string, inputChar: string): { valid: boolean; advanced: boolean; ghostText: string | null } {
    const session = this.sessions.get(fileId);
    if (!session || !session.active || session.currentTokenIndex >= session.tokens.length) {
      return { valid: false, advanced: false, ghostText: null };
    }

    const currentToken = session.tokens[session.currentTokenIndex];
    const expectedChar = currentToken[session.currentTokenProgress];

    // Direct character match
    if (inputChar === expectedChar) {
      session.currentTokenProgress++;

      // Check if token is complete
      if (session.currentTokenProgress >= currentToken.length) {
        session.currentTokenIndex++;
        session.currentTokenProgress = 0;

        // Skip pure whitespace/newline tokens automatically if the user just typed the right character
        // Actually, don't auto-skip — let the user type or press Enter for newlines
      }

      // Check if session is complete
      if (session.currentTokenIndex >= session.tokens.length) {
        this.endSession(fileId);
        return { valid: true, advanced: true, ghostText: null };
      }

      this.notify();
      return { valid: true, advanced: true, ghostText: this.getGhostText(fileId) };
    }

    // Newline handling: Enter key sends '\n', match against newline tokens
    if (inputChar === '\n' && expectedChar === '\n') {
      session.currentTokenProgress++;
      if (session.currentTokenProgress >= currentToken.length) {
        session.currentTokenIndex++;
        session.currentTokenProgress = 0;
      }
      if (session.currentTokenIndex >= session.tokens.length) {
        this.endSession(fileId);
        return { valid: true, advanced: true, ghostText: null };
      }
      this.notify();
      return { valid: true, advanced: true, ghostText: this.getGhostText(fileId) };
    }

    // Mild typo tolerance — allow the character but mark mismatch
    // We still advance to keep the flow going
    const dist = simpleLevenshtein(inputChar, expectedChar || '');
    if (dist <= 1) {
      session.currentTokenProgress++;
      if (session.currentTokenProgress >= currentToken.length) {
        session.currentTokenIndex++;
        session.currentTokenProgress = 0;
      }
      if (session.currentTokenIndex >= session.tokens.length) {
        this.endSession(fileId);
        return { valid: true, advanced: true, ghostText: null };
      }
      this.notify();
      return { valid: true, advanced: true, ghostText: this.getGhostText(fileId) };
    }

    return { valid: false, advanced: false, ghostText: this.getGhostText(fileId) };
  }

  /**
   * Process a batch of characters (e.g., paste or fast typing)
   */
  processBatch(fileId: string, text: string): void {
    for (const char of text) {
      this.processInput(fileId, char);
    }
  }

  /**
   * Sync the learner position with the current editor content.
   * Called when the user edits earlier parts of the code.
   */
  syncWithContent(fileId: string, editorContent: string): void {
    const session = this.sessions.get(fileId);
    if (!session || !session.active) return;

    // Find how much of the generated code matches the editor content
    const generated = session.fullCode;
    let matchLen = 0;
    const maxCheck = Math.min(editorContent.length, generated.length);

    for (let i = 0; i < maxCheck; i++) {
      if (editorContent[i] === generated[i]) {
        matchLen = i + 1;
      } else {
        break;
      }
    }

    // Find which token index corresponds to this match length
    let charCount = 0;
    let tokenIdx = 0;
    let tokenProgress = 0;

    for (let t = 0; t < session.tokens.length; t++) {
      const token = session.tokens[t];
      if (charCount + token.length <= matchLen) {
        charCount += token.length;
        tokenIdx = t + 1;
        tokenProgress = 0;
      } else {
        tokenIdx = t;
        tokenProgress = matchLen - charCount;
        break;
      }
    }

    session.currentTokenIndex = tokenIdx;
    session.currentTokenProgress = tokenProgress;
    this.notify();
  }

  // ─── Session Lifecycle ───

  /** End and clean up a session */
  endSession(fileId: string): void {
    const session = this.sessions.get(fileId);
    if (session) {
      session.active = false;
    }
    this.sessions.delete(fileId);
    this.notify();
  }

  /** Clear all sessions (e.g., on app refresh or learner mode disable) */
  clearAll(): void {
    this.sessions.clear();
    this.notify();
  }

  /** Check if any session is active */
  hasActiveSession(): boolean {
    for (const session of this.sessions.values()) {
      if (session.active || session.generating) return true;
    }
    return false;
  }

  /** Get all active session IDs */
  getActiveSessionIds(): string[] {
    const ids: string[] = [];
    for (const [id, session] of this.sessions) {
      if (session.active || session.generating) ids.push(id);
    }
    return ids;
  }

  // ─── Subscription (for React) ───

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Get a snapshot for React useSyncExternalStore */
  getSnapshot(): Map<string, LearnerSession> {
    return this.sessions;
  }
}

// Export singleton instance
export const learnerEngine = new LearnerEngineImpl();
