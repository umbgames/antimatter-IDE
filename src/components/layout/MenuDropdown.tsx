import { useEffect, useRef } from 'react';

export interface MenuAction {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void;
}

export interface MenuSeparator {
  id: string;
  type: 'separator';
}

export interface MenuLabel {
  id: string;
  type: 'label';
  label: string;
}

export type MenuItem = MenuAction | MenuSeparator | MenuLabel;

interface Props {
  items: MenuItem[];
  anchorRect: DOMRect | null;
  onClose: () => void;
}

function isSeparator(item: MenuItem): item is MenuSeparator {
  return 'type' in item && item.type === 'separator';
}

function isLabel(item: MenuItem): item is MenuLabel {
  return 'type' in item && item.type === 'label';
}

export function MenuDropdown({ items, anchorRect, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!anchorRect) return null;

  const style: React.CSSProperties = {
    top: anchorRect.bottom,
    left: anchorRect.left
  };

  return (
    <>
      <div className="dropdown-backdrop" onClick={onClose} />
      <div className="dropdown-menu" ref={menuRef} style={style}>
        {items.map((item) => {
          if (isSeparator(item)) {
            return <div key={item.id} className="dropdown-menu__separator" />;
          }
          if (isLabel(item)) {
            return (
              <div key={item.id} className="dropdown-menu__label">
                {item.label}
              </div>
            );
          }
          return (
            <button
              key={item.id}
              className={`dropdown-menu__item ${item.disabled ? 'disabled' : ''}`}
              onClick={() => {
                item.action?.();
                onClose();
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="dropdown-menu__shortcut">{item.shortcut}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
