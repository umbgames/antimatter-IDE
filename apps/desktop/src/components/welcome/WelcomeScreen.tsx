import { APP_NAME, APP_TAGLINE, type RecentProject } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';

export function WelcomeScreen() {
  const { recentProjects, setProvidersOpen, setSettingsOpen } = useAppStore();

  return (
    <section className="panel welcome-screen">
      <div className="hero-card">
        <div className="eyebrow">Local-first · Open-source · Desktop-native</div>
        <h1>{APP_NAME}</h1>
        <p>{APP_TAGLINE}</p>
        <div className="row-actions">
          <button className="button primary" onClick={() => setProvidersOpen(true)}>
            Configure Providers
          </button>
          <button className="button subtle" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
        <div className="umb-badge">Built by UMB Games and Technology Ltd</div>
      </div>

      <div className="welcome-grid">
        <article className="info-card">
          <h3>What Antimatter is</h3>
          <ul>
            <li>Desktop-first agentic IDE built with Tauri, Rust, React, and Monaco</li>
            <li>No signup or cloud account required</li>
            <li>Use OpenAI, Anthropic, Gemini, Groq, local endpoints, or custom APIs</li>
          </ul>
        </article>
        <article className="info-card">
          <h3>Important</h3>
          <ul>
            <li>Antimatter does not ship a model — bring your own key</li>
            <li>Speed and quality depend on your chosen provider</li>
            <li>Risky actions go through approvals and diff previews</li>
          </ul>
        </article>
      </div>

      <div className="info-card">
        <h3>Recent Projects</h3>
        {recentProjects.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No recent projects. Open a folder to get started.</p>
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
