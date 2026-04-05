import { useMemo, useState } from 'react';
import { useAppStore, type PaletteItem } from '@/store/appStore';

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
      ? paletteItems.filter((item: PaletteItem) => `${item.title} ${item.category}`.toLowerCase().includes(value))
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
          {filtered.map((item: PaletteItem) => (
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
