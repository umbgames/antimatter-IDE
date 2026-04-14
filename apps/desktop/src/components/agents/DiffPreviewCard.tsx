import type { ApprovalRequest } from '@antimatter/shared';

interface Props {
  request: ApprovalRequest;
  onApprove: (request: ApprovalRequest) => void;
  onReject: (request: ApprovalRequest) => void;
}

export function DiffPreviewCard({ request, onApprove, onReject }: Props) {
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
        <button className="button subtle" onClick={() => onReject(request)}>Reject</button>
        <button className="button primary" onClick={() => onApprove(request)}>Approve</button>
      </div>
    </article>
  );
}
