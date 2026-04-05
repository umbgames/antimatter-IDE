interface Props {
  title: string;
}

export function TitleBar({ title }: Props) {
  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <div className="brand-mark">A</div>
        <div>
          <strong>{title}</strong>
          <span>Local-first agentic IDE</span>
        </div>
      </div>
      <div className="titlebar__meta">BYOK · No signup · No cloud lock-in</div>
    </header>
  );
}
