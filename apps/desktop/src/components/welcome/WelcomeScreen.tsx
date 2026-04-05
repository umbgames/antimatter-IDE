import { APP_NAME, APP_TAGLINE, type RecentProject } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';

export function WelcomeScreen() {
  const { recentProjects, setProvidersOpen, setSettingsOpen } = useAppStore();

  return (
    <section className="panel welcome-screen">
      <div className="hero-card">
        <div className="eyebrow">Futuristic. Local-first. Open-source-friendly.</div>
        <h1>{APP_NAME}</h1>
        <p>{APP_TAGLINE}</p>
        <div className="row-actions">
          <button className="button primary" onClick={() => setProvidersOpen(true)}>
            Configure providers
          </button>
          <button className="button subtle" onClick={() => setSettingsOpen(true)}>
            Open settings
          </button>
        </div>
      </div>

      <div className="welcome-grid">
        <article className="info-card">
          <h3>What Antimatter is</h3>
          <ul>
            <li>Desktop-first agentic IDE built with Tauri, Rust, React, and Monaco</li>
            <li>No signup or cloud account required</li>
            <li>Use OpenAI, Anthropic, Gemini, local endpoints, or custom OpenAI-compatible APIs</li>
          </ul>
        </article>
        <article className="info-card">
          <h3>Important reality check</h3>
          <ul>
            <li>Antimatter does not ship a model</li>
            <li>Speed and quality depend on your provider, endpoint, and hardware</li>
            <li>Risky actions should go through approvals and diff previews</li>
          </ul>
        </article>
      </div>

      <div className="info-card">
        <h3>Recent projects</h3>
        {recentProjects.length === 0 ? (
          <p>No recent projects yet.</p>
        ) : (
          <div className="recent-list">
            {recentProjects.map((project: RecentProject) => (
              <div key={project.path} className="recent-item">
                <strong>{project.name}</strong>
                <span>{project.path}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
