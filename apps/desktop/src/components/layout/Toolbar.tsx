import { useCallback, useRef, useState } from 'react';
import { MenuDropdown, type MenuItem } from './MenuDropdown';
import { useAppStore } from '@/store/appStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import logo from '@/assets/logo.svg';

interface Props {
  onOpenSettings: () => void;
  onOpenProviders: () => void;
  onOpenFolder: () => void;
  onSaveFile: () => void;
  onNewFile: () => void;
  onCloseFile: () => void;
  onCloseAllFiles: () => void;
  onToggleTerminal: () => void;
  onRunCommand: () => void;
}

interface MenuDefinition {
  label: string;
  items: MenuItem[];
}

export function Toolbar({
  onOpenSettings,
  onOpenProviders,
  onOpenFolder,
  onSaveFile,
  onNewFile,
  onCloseFile,
  onCloseAllFiles,
  onToggleTerminal,
  onRunCommand
}: Props) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const menuRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const {
    theme,
    setTheme,
    agentDockSide,
    setAgentDockSide,
    setCommandPaletteOpen,
    bottomPanelOpen,
    toggleBottomPanel,
    setWelcomeVisible
  } = useAppStore();

  const menus: MenuDefinition[] = [
    {
      label: 'File',
      items: [
        { id: 'file-new', label: 'New File', shortcut: 'Ctrl+N', action: onNewFile },
        { id: 'sep-1', type: 'separator' },
        { id: 'file-open-folder', label: 'Open Folder…', shortcut: 'Ctrl+Shift+O', action: onOpenFolder },
        { id: 'sep-2', type: 'separator' },
        { id: 'file-save', label: 'Save', shortcut: 'Ctrl+S', action: onSaveFile },
        { id: 'file-save-as', label: 'Save As…', shortcut: 'Ctrl+Shift+S', disabled: true },
        { id: 'file-save-all', label: 'Save All', disabled: true },
        { id: 'sep-3', type: 'separator' },
        { id: 'file-close', label: 'Close File', shortcut: 'Ctrl+W', action: onCloseFile },
        { id: 'file-close-all', label: 'Close All Files', action: onCloseAllFiles },
        { id: 'sep-4', type: 'separator' },
        { id: 'file-settings', label: 'Preferences', shortcut: 'Ctrl+,', action: onOpenSettings }
      ]
    },
    {
      label: 'Edit',
      items: [
        { id: 'edit-undo', label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
        { id: 'edit-redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: () => document.execCommand('redo') },
        { id: 'sep-e1', type: 'separator' },
        { id: 'edit-cut', label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
        { id: 'edit-copy', label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
        { id: 'edit-paste', label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
        { id: 'sep-e2', type: 'separator' },
        { id: 'edit-select-all', label: 'Select All', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') },
        { id: 'edit-find', label: 'Find & Replace', shortcut: 'Ctrl+H', disabled: true }
      ]
    },
    {
      label: 'View',
      items: [
        { id: 'view-palette', label: 'Command Palette…', shortcut: 'Ctrl+P', action: () => setCommandPaletteOpen(true) },
        { id: 'sep-v1', type: 'separator' },
        { id: 'view-label', type: 'label', label: 'Appearance' },
        {
          id: 'view-theme',
          label: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
          action: () => setTheme(theme === 'dark' ? 'light' : 'dark')
        },
        { id: 'sep-v2', type: 'separator' },
        { id: 'view-label2', type: 'label', label: 'Panels' },
        {
          id: 'view-bottom',
          label: bottomPanelOpen ? 'Hide Bottom Panel' : 'Show Bottom Panel',
          shortcut: 'Ctrl+B',
          action: toggleBottomPanel
        },
        {
          id: 'view-agent-left',
          label: 'Dock Agent Left',
          action: () => setAgentDockSide('left'),
          disabled: agentDockSide === 'left'
        },
        {
          id: 'view-agent-right',
          label: 'Dock Agent Right',
          action: () => setAgentDockSide('right'),
          disabled: agentDockSide === 'right'
        },
        { id: 'sep-v3', type: 'separator' },
        { id: 'view-welcome', label: 'Show Welcome', action: () => setWelcomeVisible(true) }
      ]
    },
    {
      label: 'Navigate',
      items: [
        { id: 'nav-goto', label: 'Go to File…', shortcut: 'Ctrl+P', action: () => setCommandPaletteOpen(true) },
        { id: 'nav-goto-line', label: 'Go to Line…', shortcut: 'Ctrl+G', disabled: true },
        { id: 'nav-goto-symbol', label: 'Go to Symbol…', shortcut: 'Ctrl+Shift+O', disabled: true },
        { id: 'sep-n1', type: 'separator' },
        { id: 'nav-search', label: 'Search in Workspace', shortcut: 'Ctrl+Shift+F', disabled: true }
      ]
    },
    {
      label: 'Terminal',
      items: [
        {
          id: 'term-toggle',
          label: bottomPanelOpen ? 'Hide Terminal' : 'Show Terminal',
          shortcut: 'Ctrl+B',
          action: onToggleTerminal
        },
        { id: 'sep-t1', type: 'separator' },
        { id: 'term-run', label: 'Run Command…', action: onRunCommand },
        { id: 'term-clear', label: 'Clear Terminal', disabled: true }
      ]
    },
    {
      label: 'Agents',
      items: [
        { id: 'agent-providers', label: 'Configure Providers…', action: onOpenProviders },
        { id: 'sep-a1', type: 'separator' },
        { id: 'agent-label', type: 'label', label: 'Agent Layout' },
        {
          id: 'agent-dock-left',
          label: 'Dock Agent Panel Left',
          action: () => setAgentDockSide('left'),
          disabled: agentDockSide === 'left'
        },
        {
          id: 'agent-dock-right',
          label: 'Dock Agent Panel Right',
          action: () => setAgentDockSide('right'),
          disabled: agentDockSide === 'right'
        }
      ]
    },
    {
      label: 'Help',
      items: [
        { id: 'help-welcome', label: 'Welcome Screen', action: () => setWelcomeVisible(true) },
        { id: 'help-shortcuts', label: 'Keyboard Shortcuts', disabled: true },
        { id: 'sep-h1', type: 'separator' },
        { id: 'help-docs', label: 'Documentation', disabled: true },
        { id: 'help-about', label: 'About Antimatter', action: () => setWelcomeVisible(true) }
      ]
    }
  ];

  const handleMenuClick = useCallback(
    (label: string) => {
      if (activeMenu === label) {
        setActiveMenu(null);
        setAnchorRect(null);
        return;
      }
      const btn = menuRefs.current[label];
      if (btn) {
        setAnchorRect(btn.getBoundingClientRect());
        setActiveMenu(label);
      }
    },
    [activeMenu]
  );

  const handleMenuHover = useCallback(
    (label: string) => {
      if (activeMenu && activeMenu !== label) {
        const btn = menuRefs.current[label];
        if (btn) {
          setAnchorRect(btn.getBoundingClientRect());
          setActiveMenu(label);
        }
      }
    },
    [activeMenu]
  );

  const activeMenuDef = menus.find((m) => m.label === activeMenu);

  return (
    <div className="toolbar" data-tauri-drag-region>
      <div className="toolbar__brand" data-tauri-drag-region>
        <div className="brand-mark">
          <img src={logo} alt="Antimatter" />
        </div>
      </div>
      <nav className="toolbar__menus" data-tauri-drag-region>
        {menus.map((menu) => (
          <button
            key={menu.label}
            ref={(el) => { menuRefs.current[menu.label] = el; }}
            className={`toolbar__menu-trigger ${activeMenu === menu.label ? 'active' : ''}`}
            onClick={() => handleMenuClick(menu.label)}
            onMouseEnter={() => handleMenuHover(menu.label)}
          >
            {menu.label}
          </button>
        ))}
      </nav>
      <div className="toolbar__drag-space" data-tauri-drag-region style={{ flex: 1, height: '100%' }} />
      <div className="toolbar__actions">
        <button className="button subtle" onClick={onOpenProviders}>
          Providers
        </button>
        <button className="button subtle" onClick={onOpenSettings}>
          ⚙
        </button>
      </div>

      <div className="toolbar__window-controls" data-tauri-drag-region="false">
        <button 
          className="window-control minimize" 
          data-tauri-drag-region="false"
          onClick={async () => {
            try {
              await getCurrentWindow().minimize();
            } catch (e) {
              console.error('Minimize error:', e);
            }
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="4" width="8" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button 
          className="window-control maximize" 
          data-tauri-drag-region="false"
          onClick={async () => {
             try {
               await getCurrentWindow().toggleMaximize();
             } catch (e) {
               console.error('Maximize error:', e);
             }
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" fill="none"/>
          </svg>
        </button>
        <button 
          className="window-control close" 
          data-tauri-drag-region="false"
          onClick={async () => {
             try {
               await getCurrentWindow().close();
             } catch (e) {
               console.error('Close error:', e);
             }
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {activeMenuDef && (
        <MenuDropdown
          items={activeMenuDef.items}
          anchorRect={anchorRect}
          onClose={() => {
            setActiveMenu(null);
            setAnchorRect(null);
          }}
        />
      )}
    </div>
  );
}
