import Link from "next/link";
import { AppShell } from "@/components/product/AppShell";
import { PageHeader, EmptyState } from "@/components/product/ui";
import { FormRows } from "@/components/product/WorkspaceViews";
import { getPoolDb } from "@/lib/db/node";
import { listForms } from "@/lib/forms/service";
import { requireWorkspace } from "@/lib/workspace/session";
export const dynamic = "force-dynamic";
export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const selected =
    status === "draft" || status === "published" ? status : "all";
  const { workspace, profile } = await requireWorkspace();
  const forms = await listForms(getPoolDb(), workspace.id);
  const rows = forms.filter(
    (row) => selected === "all" || row.status === selected,
  );
  return (
    <AppShell businessName={profile.businessName}>
      <main className="workspace-page">
        <PageHeader
          eyebrow="Your onboarding library"
          title="Forms"
          description="Thoughtful questions. A better start for every client."
          action={
            <Link href="/forms/new" className="button button-primary">
              + Create onboarding
            </Link>
          }
        />
        <div className="list-toolbar">
          <nav className="filter-tabs" aria-label="Filter forms">
            {[
              ["all", "All forms"],
              ["draft", "Draft"],
              ["published", "Published"],
            ].map(([id, label]) => (
              <Link
                key={id}
                href={id === "all" ? "/forms" : "/forms?status=" + id}
                aria-current={selected === id ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-sm text-muted">
            {rows.length} {rows.length === 1 ? "form" : "forms"}
          </p>
        </div>
        {rows.length ? (
          <FormRows rows={rows} />
        ) : (
          <EmptyState
            title={
              forms.length
                ? "No forms in this view."
                : "Your first hello starts here."
            }
            description={
              forms.length
                ? "Choose another filter to see your onboarding forms."
                : "Build an onboarding that fits your coaching. Start with your Agent or write the questions yourself."
            }
            href={forms.length ? "/forms" : "/forms/new"}
            action={
              forms.length ? "Show all forms" : "Create your first onboarding"
            }
          />
        )}
      </main>
    </AppShell>
  );
}
