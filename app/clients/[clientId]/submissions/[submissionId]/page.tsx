import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/product/AppShell";
import { SubmissionAnswers, parseSubmissionSchema } from "@/app/clients/SubmissionAnswers";
import { getPoolDb } from "@/lib/db/node";
import { getWorkspaceSubmission } from "@/lib/clients/service";
import { getCoachBrief, listReviewFlags } from "@/lib/intelligence/service";
import { FormServiceError } from "@/lib/forms/errors";
import { requireWorkspace } from "@/lib/workspace/session";
import { MarkReviewedButton } from "./MarkReviewedButton";
import { CoachBriefPanel } from "./CoachBriefPanel";
import { fieldLabelMap } from "@/lib/intelligence/payload";
import { submissionSnapshot } from "@/lib/review/snapshot";
import { reviewStatusLabel } from "@/lib/review/status";
import type { OnboardingAnswers } from "@/lib/onboarding/schema/types";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; submissionId: string }>;
}) {
  const { clientId, submissionId } = await params;
  const { workspace, profile } = await requireWorkspace();
  const loaded = await loadSubmission(workspace.id, clientId, submissionId);
  if (!loaded) notFound();
  const schema = parseSubmissionSchema(loaded.version.schema);
  const answers = loaded.submission.answers as OnboardingAnswers;
  const labels = schema ? Object.fromEntries(fieldLabelMap(schema)) : {};
  const snapshot = schema ? submissionSnapshot(schema, answers) : [];

  return (
    <AppShell businessName={profile.businessName}>
      <main className="submission-page">
        <Link href={`/clients/${loaded.client.id}`} className="text-sm text-muted">
          Back to {loaded.client.fullName}
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">Client</p>
            <h1 className="font-display text-4xl tracking-tight">{loaded.client.fullName}</h1>
            <p className="mt-2 text-muted">
              {loaded.form.name} · Version {loaded.version.versionNumber} · {loaded.submission.submittedAt.toLocaleString()}
            </p>
            <p className="mt-2 text-sm">
              {loaded.submission.reviewStatus === "needs_review" ? (
                <span className="rounded-full bg-warn/15 px-3 py-1 text-warn">Needs Review</span>
              ) : (
                reviewStatusLabel(loaded.submission.reviewStatus)
              )}
            </p>
          </div>
          {loaded.submission.reviewStatus !== "reviewed" ? (
            <MarkReviewedButton submissionId={loaded.submission.id} />
          ) : null}
        </div>
        {snapshot.length ? (
          <section className="mt-10 grid gap-3 sm:grid-cols-2">
            {snapshot.map((item) => (
              <article key={item.fieldKey} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm text-muted">{item.title}</p>
                <p className="mt-1 font-display text-xl tracking-tight">{item.value}</p>
              </article>
            ))}
          </section>
        ) : null}
        {loaded.submission.notes ? (
          <aside className="mt-6 rounded-2xl border border-line bg-surface p-4">
            <p className="font-display text-sm tracking-tight">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-muted">{loaded.submission.notes}</p>
          </aside>
        ) : null}
        <nav className="submission-jumps" aria-label="Submission sections"><a href="#submitted-information">Original answers</a><a href="#review-flags">Review Flags</a><a href="#coach-brief">AI Coach Brief</a></nav>
        <div className="submission-layout"><section id="submitted-information" className="original-answers">
          <p className="eyebrow">01 · Client-provided information</p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">Original answers</h2>
          <div className="mt-6">
            {schema ? (
              <SubmissionAnswers schema={schema} answers={answers} />
            ) : (
              <p className="text-muted">This submission’s form version could not be displayed.</p>
            )}
          </div>
        </section>
        <aside className="submission-context"><section id="review-flags" className="review-flags">
          <p className="eyebrow">02 · Rule-based Review Flags</p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">Coach review needed</h2>
          {loaded.flags.length === 0 ? (
            <p className="mt-3 text-muted">No Review Flags were triggered. Continue reviewing the original answers.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {loaded.flags.map((flag) => (
                <li key={flag.id} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Review flag</p>
                  <p className="mt-1 font-display text-xl tracking-tight">{flag.label}</p>
                  <p className="mt-2 text-sm text-muted">Based on:</p>
                  <ul className="text-sm text-muted">
                    {flag.sourceFieldKeys.map((key) => (
                      <li key={key}>{labels[key] ?? key}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
        <CoachBriefPanel
          submissionId={loaded.submission.id}
          initial={loaded.brief ? { status: loaded.brief.status, payload: loaded.brief.payload } : { status: "pending" }}
          labels={labels}
        /></aside></div>
      </main>
    </AppShell>
  );
}

async function loadSubmission(workspaceId: string, clientId: string, submissionId: string) {
  const db = getPoolDb();
  try {
    const row = await getWorkspaceSubmission(db, workspaceId, submissionId);
    if (row.client.id !== clientId) return null;
    const flags = await listReviewFlags(db, workspaceId, submissionId);
    const brief = await getCoachBrief(db, workspaceId, submissionId);
    return { ...row, flags, brief };
  } catch (error) {
    if (error instanceof FormServiceError && error.status === 404) return null;
    throw error;
  }
}
