interface Props {
  title: string;
}

export function TitleBar({ title }: Props) {
  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <div className="brand-mark">A</div>
        <strong>{title}</strong>
        <span className="titlebar__umb">UMB Games and Technology Ltd</span>
      </div>
      <div className="titlebar__meta">Local-first · BYOK · No cloud lock-in</div>
    </header>
  );
}
