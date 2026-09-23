import { AppShell } from "@/components/product/AppShell";
import { DashboardView } from "@/components/product/WorkspaceViews";
import { requireWorkspace } from "@/lib/workspace/session";
import { getPoolDb } from "@/lib/db/node";
import { listForms } from "@/lib/forms/service";
import { listClients } from "@/lib/clients/service";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { workspace, profile } = await requireWorkspace();
  const db = getPoolDb();
  const [forms, clients] = await Promise.all([
    listForms(db, workspace.id),
    listClients(db, workspace.id),
  ]);
  return (
    <AppShell businessName={profile.businessName}>
      <DashboardView
        coachName={profile.coachName}
        forms={forms}
        clients={clients}
      />
    </AppShell>
  );
}
