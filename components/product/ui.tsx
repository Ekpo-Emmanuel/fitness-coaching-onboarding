import type { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-actions">{action}</div>}</header>;
}
export function StatusBadge({ status, children }: { status: string; children?: ReactNode }) {
  const labels: Record<string, string> = { draft: "Draft", published: "Published", new: "New", needs_review: "Needs review", reviewed: "Reviewed", connected: "Connected", disabled: "Disabled", error: "Needs attention", failed: "Failed delivery", sent: "Sent", pending: "Pending", processing: "Sending", proposed: "Proposed changes", applied: "Applied", rejected: "Rejected", superseded: "Outdated proposal" };
  return <span className="status-badge" data-status={status}><span aria-hidden="true" />{children || labels[status] || status}</span>;
}
export function EmptyState({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return <section className="empty-state"><span className="empty-mark" aria-hidden="true">↗</span><h2>{title}</h2><p>{description}</p>{href && action && <Link className="button button-primary" href={href}>{action}</Link>}</section>;
}
