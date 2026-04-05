import type { ApprovalRequest } from '@antimatter/shared';

interface Props {
  request: ApprovalRequest;
}

export function DiffPreviewCard({ request }: Props) {
  return (
    <article className="diff-card">
      <header>
        <strong>{request.title}</strong>
        <span className={`risk-badge ${request.risk}`}>{request.risk}</span>
      </header>
      <p>{request.description}</p>
      {request.diff && (
        <div className="diff-grid">
          <div>
            <h5>Original</h5>
            <pre>{request.diff.original}</pre>
          </div>
          <div>
            <h5>Proposed</h5>
            <pre>{request.diff.proposed}</pre>
          </div>
        </div>
      )}
      <div className="diff-actions">
        <button className="button subtle">Reject</button>
        <button className="button primary">Approve</button>
      </div>
    </article>
  );
}
