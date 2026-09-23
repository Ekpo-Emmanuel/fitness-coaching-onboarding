import Link from "next/link";
import { PageHeader } from "@/components/product/ui";
import { AppShell } from "@/components/product/AppShell";
import { requireWorkspace } from "@/lib/workspace/session";
import { WorkspaceDangerZone } from "./WorkspaceDangerZone";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile, workspace } = await requireWorkspace();
  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <PageHeader eyebrow="Workspace preferences" title="Settings" description={workspace.name} />
        <div className="settings-layout"><div>
        <section className="settings-section"><h2>Your coaching profile</h2><p>The context behind your onboarding. Tell the Agent who you coach and how you work.</p><Link className="button" href="/settings/profile">Edit coaching profile ↗</Link></section>
        <section className="settings-section"><h2>Connected tools</h2><p>Manage Google Sheets, signed webhooks, and delivery history.</p><Link className="button" href="/settings/connections">Manage connections ↗</Link></section>
        <section className="settings-section"><h2>Your workspace data</h2><p>Download your profile, forms, clients, submissions, flags, and briefs as JSON. Secrets are excluded.</p><a className="button" href="/api/workspace">Export workspace</a></section>
        <WorkspaceDangerZone /></div><aside className="settings-aside"><h2>A workspace that fits you.</h2><p>Your coaching profile gives the Agent useful context. Updating it does not change published forms.</p></aside></div>
      </main>
    </AppShell>
  );
}
