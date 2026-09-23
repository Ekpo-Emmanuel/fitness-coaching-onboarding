import { PageHeader } from "@/components/product/ui";
import { AppShell } from "@/components/product/AppShell";
import { getPoolDb } from "@/lib/db/node";
import { googleOAuthConfigured } from "@/lib/integrations/google-oauth";
import { listDeliveries, listIntegrations, publicDelivery, publicIntegration } from "@/lib/integrations/service";
import { requireWorkspace } from "@/lib/workspace/session";
import { ConnectionsClient } from "./ConnectionsClient";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const { workspace, profile } = await requireWorkspace();
  const db = getPoolDb();
  const integrations = await listIntegrations(db, workspace.id);
  const deliveries = await listDeliveries(db, workspace.id);

  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <PageHeader eyebrow="Your workflow" title="Connections" description="Keep your client context connected to the tools you use." />
        <ConnectionsClient
          googleConfigured={googleOAuthConfigured()}
          integrations={integrations.map(publicIntegration)}
          deliveries={deliveries.map(publicDelivery)}
        />
      </main>
    </AppShell>
  );
}
