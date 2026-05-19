// ─── useLearnerMode Hook ───
// React hook that integrates the LearnerEngine with Monaco Editor.
// Handles: session lifecycle, ghost text decoration, typing interception,
// and progressive reveal rendering.

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { learnerEngine, type LearnerSession, type LearnerStatus } from '@/services/LearnerEngine';
import { useAppStore } from '@/store/appStore';

interface UseLearnerModeOptions {
  /** Monaco editor instance */
  editor: any;
  /** Monaco namespace */
  monaco: any;
  /** Current active file path */
  filePath?: string;
  /** Current active file name */
  fileName?: string;
  /** Whether learner mode is enabled */
  enabled: boolean;
}

interface UseLearnerModeReturn {
  /** Current learner status for the active file */
  status: LearnerStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Whether a session is active */
  isActive: boolean;
  /** Manually trigger generation for current file */
  triggerGeneration: () => Promise<void>;
  /** End the current session */
  endSession: () => void;
}

export function useLearnerMode({
  editor,
  monaco,
  filePath,
  fileName,
  enabled
}: UseLearnerModeOptions): UseLearnerModeReturn {
  const decorationsRef = useRef<any>(null);
  const contentWidgetRef = useRef<any>(null);
  const disposablesRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);
  const lastSyncedContentRef = useRef<string>('');

  const selectedProviderId = useAppStore(s => s.selectedProviderId);
  const workspacePath = useAppStore(s => s.workspacePath);
  const theme = useAppStore(s => s.theme);

  // Subscribe to learner engine state changes
  const sessions = useSyncExternalStore(
    (cb) => learnerEngine.subscribe(cb),
    () => learnerEngine.getSnapshot()
  );

  const session = filePath ? learnerEngine.getSession(filePath) : undefined;
  const status = filePath ? learnerEngine.getStatus(filePath) : 'idle';
  const progress = filePath ? learnerEngine.getProgress(filePath) : 0;
  const isActive = status === 'active';

  // ─── Ghost Text Rendering ───
  const updateGhostText = useCallback(() => {
    if (!editor || !monaco || !filePath) return;

    // Clean up previous decorations
    if (decorationsRef.current) {
      decorationsRef.current.clear();
      decorationsRef.current = null;
    }

    // Remove previous content widget
    if (contentWidgetRef.current) {
      try {
        editor.removeContentWidget(contentWidgetRef.current);
      } catch { /* widget may already be removed */ }
      contentWidgetRef.current = null;
    }

    const ghostText = learnerEngine.getGhostText(filePath);
    if (!ghostText || !isActive) return;

    const position = editor.getPosition();
    if (!position) return;

    // Create inline content widget for ghost text
    const widgetId = `learner-ghost-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Get the remaining text for the current line to show context
    const sessionData = learnerEngine.getSession(filePath);
    if (!sessionData) return;

    // Calculate what ghost text to show (current token remainder)
    let displayGhost = ghostText;
    
    // For newline tokens, show a visual indicator
    if (displayGhost === '\n') {
      displayGhost = '↵';
    }

    // Limit display length to avoid UI clutter — show next few tokens
    const allRemaining = learnerEngine.getFullRemainingText(filePath) || '';
    const nextLineEnd = allRemaining.indexOf('\n');
    const lineGhost = nextLineEnd >= 0 ? allRemaining.slice(0, nextLineEnd) : allRemaining;
    // Show rest of current line as ghost
    displayGhost = lineGhost.length > 0 ? lineGhost : displayGhost;

    // Don't show pure newline/whitespace-only ghosts — that's confusing
    if (displayGhost.trim().length === 0 && displayGhost !== '↵') {
      displayGhost = '↵';
    }

    const widget = {
      getId: () => widgetId,
      getDomNode: () => {
        const node = document.createElement('span');
        node.className = 'learner-ghost-text';
        node.textContent = displayGhost;
        node.style.cssText = `
          pointer-events: none;
          user-select: none;
          white-space: pre;
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
          font-size: inherit;
          line-height: inherit;
          letter-spacing: inherit;
        `;
        return node;
      },
      getPosition: () => ({
        position: { lineNumber: position.lineNumber, column: position.column },
        preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
      })
    };

    contentWidgetRef.current = widget;
    editor.addContentWidget(widget);

  }, [editor, monaco, filePath, isActive]);

  // ─── Typing Interception ───
  useEffect(() => {
    if (!editor || !monaco || !filePath || !enabled || !isActive) return;

    // Dispose previous listeners
    disposablesRef.current.forEach(d => d.dispose());
    disposablesRef.current = [];

    // Listen for model content changes to sync learner state
    const modelChangeDisposable = editor.onDidChangeModelContent((e: any) => {
      if (isProcessingRef.current) return;

      const model = editor.getModel();
      if (!model) return;

      const currentContent = model.getValue();
      const prevContent = lastSyncedContentRef.current;

      // Process each change
      for (const change of e.changes) {
        const insertedText = change.text;
        if (insertedText.length > 0) {
          // User typed or pasted text — process through learner engine
          for (const char of insertedText) {
            learnerEngine.processInput(filePath, char);
          }
        }
      }

      lastSyncedContentRef.current = currentContent;

      // Update ghost text after processing
      requestAnimationFrame(() => updateGhostText());
    });

    disposablesRef.current.push(modelChangeDisposable);

    // Listen for cursor position changes to update ghost text position
    const cursorDisposable = editor.onDidChangeCursorPosition(() => {
      requestAnimationFrame(() => updateGhostText());
    });

    disposablesRef.current.push(cursorDisposable);

    // Initial ghost text render
    updateGhostText();

    return () => {
      disposablesRef.current.forEach(d => d.dispose());
      disposablesRef.current = [];
    };
  }, [editor, monaco, filePath, enabled, isActive, updateGhostText]);

  // ─── Session Lifecycle: Clean up on file close or mode disable ───
  useEffect(() => {
    if (!enabled && filePath) {
      learnerEngine.endSession(filePath);
    }
  }, [enabled, filePath]);

  // ─── Clean up ghost text when session ends ───
  useEffect(() => {
    if (!isActive) {
      if (contentWidgetRef.current && editor) {
        try {
          editor.removeContentWidget(contentWidgetRef.current);
        } catch { /* ignore */ }
        contentWidgetRef.current = null;
      }
      if (decorationsRef.current) {
        decorationsRef.current.clear();
        decorationsRef.current = null;
      }
    }
  }, [isActive, editor]);

  // ─── Trigger Generation ───
  const triggerGeneration = useCallback(async () => {
    if (!filePath || !fileName || !selectedProviderId || !enabled) return;

    // Gather nearby files for context
    const state = useAppStore.getState();
    const nearbyFiles = state.workspaceEntries
      .filter(e => !e.isDirectory)
      .map(e => e.name)
      .slice(0, 20);

    await learnerEngine.startSession(
      filePath,
      fileName,
      selectedProviderId,
      workspacePath || undefined,
      nearbyFiles
    );
  }, [filePath, fileName, selectedProviderId, enabled, workspacePath]);

  // ─── End Session ───
  const endSession = useCallback(() => {
    if (filePath) {
      learnerEngine.endSession(filePath);
    }
  }, [filePath]);

  // ─── Subscribe to engine updates to re-render ghost text ───
  useEffect(() => {
    const unsub = learnerEngine.subscribe(() => {
      requestAnimationFrame(() => updateGhostText());
    });
    return unsub;
  }, [updateGhostText]);

  return {
    status,
    progress,
    isActive,
    triggerGeneration,
    endSession
  };
}
