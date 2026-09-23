import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/product/AppShell";
import { getPoolDb } from "@/lib/db/node";
import { getWorkspaceClient, listClientSubmissions } from "@/lib/clients/service";
import { FormServiceError } from "@/lib/forms/errors";
import { StatusBadge } from "@/components/product/ui";
import { requireWorkspace } from "@/lib/workspace/session";
import { DeleteClientButton } from "./DeleteClientButton";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspace, profile } = await requireWorkspace();
  const loaded = await loadClient(workspace.id, clientId);
  if (!loaded) notFound();

  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <Link href="/clients" className="text-sm text-muted">
          All clients
        </Link>
        <div className="client-profile-head"><div><p className="eyebrow">Client profile</p><h1 className="mt-3 font-display text-4xl tracking-tight">{loaded.client.fullName}</h1>
        <p className="mt-2 text-muted">{loaded.client.email}</p>
        {loaded.client.phone ? <p className="text-muted">{loaded.client.phone}</p> : null}
        </div><div className="flex flex-wrap gap-3">
          <a
            className="rounded-full border border-line px-4 py-2 text-sm"
            href={`/api/clients/${loaded.client.id}`}
          >
            Export data
          </a>
          <DeleteClientButton clientId={loaded.client.id} name={loaded.client.fullName} />
        </div></div>
        <p className="mt-3 max-w-[65ch] text-sm text-muted">
          Export is JSON: client identity, submissions, flags, notes, and Coach Brief if present. The filename does not include
          email. Deleting removes this application&apos;s copy. External Sheets/webhook copies are not deleted.
        </p>
        <h2 className="mt-10 font-display text-2xl tracking-tight">Onboarding history</h2>
        {loaded.submissions.length === 0 ? (
          <p className="mt-3 text-muted">No submissions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-[1.5rem] border border-line bg-surface">
            {loaded.submissions.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/clients/${loaded.client.id}/submissions/${row.id}`}
                  className="block px-5 py-4 hover:bg-accent-soft/40"
                >
                  <p className="font-display text-lg tracking-tight">{row.formName}</p>
                  <p className="text-sm text-muted">
                    Version {row.versionNumber} · {row.submittedAt.toLocaleString()} ·{" "}
                    <StatusBadge status={row.reviewStatus} />
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

async function loadClient(workspaceId: string, clientId: string) {
  const db = getPoolDb();
  try {
    const record = await getWorkspaceClient(db, workspaceId, clientId);
    const submissions = await listClientSubmissions(db, workspaceId, clientId);
    return { client: record, submissions };
  } catch (error) {
    if (error instanceof FormServiceError && error.status === 404) return null;
    throw error;
  }
}
