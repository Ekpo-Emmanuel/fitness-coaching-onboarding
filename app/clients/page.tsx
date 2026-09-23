import Link from "next/link";
import { AppShell } from "@/components/product/AppShell";
import { getPoolDb } from "@/lib/db/node";
import { listClients } from "@/lib/clients/service";
import { requireWorkspace } from "@/lib/workspace/session";
import { PageHeader, EmptyState } from "@/components/product/ui";
import { ClientRows } from "@/components/product/WorkspaceViews";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "needs_review", label: "Needs Review" },
  { id: "reviewed", label: "Reviewed" },
] as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const filter = FILTERS.some((item) => item.id === status && item.id !== "all")
    ? (status as "new" | "needs_review" | "reviewed")
    : undefined;
  const { workspace, profile } = await requireWorkspace();
  const rows = await listClients(getPoolDb(), workspace.id, q, filter);

  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <PageHeader eyebrow="People, not paperwork" title="Clients" description="Get to know the person behind every submission." />
        <div className="list-toolbar"><form className="search-form" role="search">
          <label className="sr-only" htmlFor="client-search">Search clients by name or email</label>
          <input id="client-search" name="q" defaultValue={q ?? ""} placeholder="Search name or email" />
          {filter ? <input type="hidden" name="status" value={filter} /> : null}
          <button className="button" type="submit">Search</button>
        </form>
        <nav className="filter-tabs" aria-label="Filter clients">
          {FILTERS.map((item) => {
            const href = item.id === "all" ? "/clients" : `/clients?status=${item.id}`;
            const active = (status ?? "all") === item.id;
            return (
              <Link
                key={item.id}
                href={q ? `${href}${item.id === "all" ? "?" : "&"}q=${encodeURIComponent(q)}` : href}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        </div>
        {rows.length ? <ClientRows rows={rows} /> : <EmptyState title={q || filter ? "No matching clients." : "Your next client starts here."} description={q || filter ? "Try another name or clear your filters." : "Clients appear here after completing a published onboarding form."} href={q || filter ? "/clients" : "/forms"} action={q || filter ? "Clear filters" : "Go to forms"} />}
      </main>
    </AppShell>
  );
}
