import Link from "next/link";
import { EmptyState, PageHeader, StatusBadge } from "./ui";

export type FormRow = {
  id: string;
  name: string;
  status: string;
  versionNumber: number | null;
  updatedAt: Date | string;
};
export type ClientRow = {
  client: { id: string; fullName: string; email: string };
  latestFormName: string | null;
  latestReviewStatus: string | null;
  latestSubmittedAt: Date | string | null;
};
const date = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function FormRows({ rows }: { rows: FormRow[] }) {
  return (
    <ul className="data-list">
      {rows.map((row) => (
        <li key={row.id}>
          <Link className="data-row" href={`/forms/${row.id}/build`}>
            <span className="row-symbol" aria-hidden="true">
              ☷
            </span>
            <div className="row-main">
              <strong>{row.name}</strong>
              <small>
                {row.versionNumber ? `Version ${row.versionNumber} · ` : ""}
                Updated {date(row.updatedAt)}
              </small>
            </div>
            <div className="row-end">
              <StatusBadge status={row.status} />
              <span className="row-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
export function ClientRows({ rows }: { rows: ClientRow[] }) {
  return (
    <ul className="data-list">
      {rows.map((row) => (
        <li key={row.client.id}>
          <Link className="data-row" href={`/clients/${row.client.id}`}>
            <span className="row-symbol" aria-hidden="true">
              {row.client.fullName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="row-main">
              <strong>{row.client.fullName}</strong>
              <small>{row.client.email}</small>
              <small>
                {row.latestFormName}
                {row.latestSubmittedAt
                  ? ` · ${date(row.latestSubmittedAt)}`
                  : ""}
              </small>
            </div>
            <div className="row-end">
              <StatusBadge status={row.latestReviewStatus || "new"} />
              <span className="row-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
export function DashboardView({
  coachName,
  forms,
  clients,
}: {
  coachName: string;
  forms: FormRow[];
  clients: ClientRow[];
}) {
  const attention = clients
    .filter((row) => row.latestReviewStatus !== "reviewed")
    .slice(0, 4);
  return (
    <main className="workspace-page">
      <PageHeader
        eyebrow="Your workspace"
        title={`Welcome back, ${coachName.split(" ")[0]}.`}
        description="A little context makes a better beginning."
        action={
          <Link href="/forms/new" className="button button-primary">
            + Create onboarding
          </Link>
        }
      />
      <div className="dashboard-grid">
        <div>
          <section className="start-panel">
            <p className="eyebrow">Thoughtful onboarding, built together</p>
            <h2>
              Less admin.
              <br />
              More understanding.
            </h2>
            <p>
              Turn your coaching approach into the right questions. Your Agent
              drafts. You make it yours.
            </p>
            <Link href="/forms/new" className="button button-primary">
              Build with Agent <span aria-hidden="true">↗</span>
            </Link>
          </section>
          <div className="section-heading">
            <h2>Ready for your attention</h2>
            <Link className="text-link" href="/clients">
              View clients ↗
            </Link>
          </div>
          {attention.length ? (
            <ClientRows rows={attention} />
          ) : (
            <EmptyState
              title={
                clients.length
                  ? "You're up to date."
                  : "Your next client starts here."
              }
              description={
                clients.length
                  ? "Your recent clients have been reviewed. New submissions will appear here."
                  : "Share a published onboarding link. When a client responds, you'll find their information here."
              }
              href="/forms"
              action="Go to your forms"
            />
          )}
        </div>
        <aside className="dashboard-aside">
          <p className="eyebrow">Your next steps</p>
          <ol className="workflow-list">
            <li>
              <div>
                <Link href="/settings/profile">Make it personal</Link>
                <small>Keep your coaching profile up to date.</small>
              </div>
            </li>
            <li>
              <div>
                <Link href="/forms">Build your onboarding</Link>
                <small>Refine, preview, then publish.</small>
              </div>
            </li>
            <li>
              <div>
                <Link href="/clients">Start with understanding</Link>
                <small>Review answers, flags, and the AI brief.</small>
              </div>
            </li>
          </ol>
          <div className="section-heading">
            <h2>Recent forms</h2>
          </div>
          {forms.length ? (
            <FormRows rows={forms.slice(0, 3)} />
          ) : (
            <p>
              No forms yet. Your first draft starts with your coaching approach.
            </p>
          )}
          <Link className="text-link mt-5" href="/forms">
            All forms ↗
          </Link>
          <div className="section-heading">
            <h2>Keep your tools connected</h2>
          </div>
          <p>Send new submissions to Google Sheets or a signed webhook.</p>
          <Link className="text-link mt-4" href="/settings/connections">
            Manage connections ↗
          </Link>
        </aside>
      </div>
    </main>
  );
}
