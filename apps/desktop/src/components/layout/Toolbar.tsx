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
