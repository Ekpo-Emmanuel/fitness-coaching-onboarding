import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/product/AppShell";
import { getPoolDb } from "@/lib/db/node";
import { listFormSubmissions } from "@/lib/clients/service";
import { FormServiceError } from "@/lib/forms/errors";
import { getWorkspaceForm } from "@/lib/forms/service";
import { StatusBadge } from "@/components/product/ui";
import { requireWorkspace } from "@/lib/workspace/session";

export const dynamic = "force-dynamic";

export default async function FormSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { formId } = await params;
  const { status } = await searchParams;
  const filter =
    status === "new" || status === "needs_review" || status === "reviewed" ? status : undefined;
  const { workspace, profile } = await requireWorkspace();
  const loaded = await loadRows(workspace.id, formId, filter);
  if (!loaded) notFound();

  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <Link href={`/forms/${formId}/build`} className="text-sm text-muted">
          Back to editor
        </Link>
        <h1 className="mt-3 font-display text-4xl tracking-tight">{loaded.form.name}</h1>
        <p className="mt-2 text-muted">Responses</p>
        <a className="mt-4 inline-flex rounded-full border border-line px-4 py-2 text-sm" href={`/api/forms/${formId}/submissions/export`}>
          Export CSV
        </a>
        <nav className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "all", label: "All" },
            { id: "new", label: "New" },
            { id: "needs_review", label: "Needs Review" },
            { id: "reviewed", label: "Reviewed" },
          ].map((item) => (
            <Link
              key={item.id}
              href={item.id === "all" ? `/forms/${formId}/submissions` : `/forms/${formId}/submissions?status=${item.id}`}
              className={`rounded-full px-4 py-2 text-sm ${(status ?? "all") === item.id ? "bg-accent text-surface" : "border border-line"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {loaded.rows.length === 0 ? (
          <p className="mt-8 text-muted">No responses yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-[1.5rem] border border-line bg-surface">
            {loaded.rows.map((row) => (
              <li key={row.submission.id}>
                <Link
                  href={`/clients/${row.client.id}/submissions/${row.submission.id}`}
                  className="block px-5 py-4 hover:bg-accent-soft/40"
                >
                  <p className="font-display text-lg tracking-tight">{row.client.fullName}</p>
                  <p className="text-sm text-muted">
                    Version {row.versionNumber} · {row.submission.submittedAt.toLocaleString()} ·{" "}
                    <StatusBadge status={row.submission.reviewStatus} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

async function loadRows(
  workspaceId: string,
  formId: string,
  status?: "new" | "needs_review" | "reviewed",
) {
  const db = getPoolDb();
  try {
    const record = await getWorkspaceForm(db, workspaceId, formId);
    const rows = await listFormSubmissions(db, workspaceId, formId, status);
    return { form: record, rows };
  } catch (error) {
    if (error instanceof FormServiceError && error.status === 404) return null;
    throw error;
  }
}
