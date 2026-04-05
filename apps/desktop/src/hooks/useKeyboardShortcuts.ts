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
