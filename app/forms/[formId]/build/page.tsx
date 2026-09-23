import { and, eq } from "drizzle-orm";
import { formVersion } from "@/lib/db/schema";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/product/AppShell";
import { getPoolDb } from "@/lib/db/node";
import { getFormAgentThread, getAgentChangeSet, listAgentMessages } from "@/lib/agent/service";
import { FormServiceError } from "@/lib/forms/errors";
import { getWorkspaceDraft, getWorkspaceForm, listWorkspaceVersions } from "@/lib/forms/service";
import { requireWorkspace } from "@/lib/workspace/session";
import { FormBuilder } from "./FormBuilder";

export const dynamic = "force-dynamic";

export default async function BuildFormPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const { workspace, profile } = await requireWorkspace();
  const loaded = await loadBuilder(workspace.id, formId);
  if (!loaded) notFound();
  return (
    <AppShell businessName={profile.businessName}>
      <Suspense>
        <FormBuilder
          formId={loaded.record.id}
          formName={loaded.record.name}
          slug={loaded.record.slug}
          status={loaded.record.status}
          activeVersionNumber={loaded.activeVersionNumber}
          initialSchema={loaded.draft.schema}
          initialRevision={loaded.draft.revision}
          initialPublishedSnapshot={loaded.publishedSnapshot}
          initialIdentity={loaded.draft.clientIdentityMapping ?? null}
          initialReviewRules={loaded.draft.reviewRules ?? null}
          versions={loaded.versions}
          branding={{
            businessName: profile.businessName,
            coachName: profile.coachName,
            primaryColor: profile.primaryColor,
          }}
          initialMessages={loaded.messages}
          initialChangeSets={loaded.changeSets}
        />
      </Suspense>
    </AppShell>
  );
}

async function loadBuilder(workspaceId: string, formId: string) {
  const db = getPoolDb();
  try {
    const record = await getWorkspaceForm(db, workspaceId, formId);
    const draft = await getWorkspaceDraft(db, workspaceId, formId);
    const versions = await listWorkspaceVersions(db, workspaceId, formId);
    const publishedRows = record.activePublishedVersionId ? await db.select().from(formVersion).where(and(eq(formVersion.id, record.activePublishedVersionId), eq(formVersion.workspaceId, workspaceId))).limit(1) : [];
    const published = publishedRows[0];
    const active = versions.find((version) => version.id === record.activePublishedVersionId);
    const thread = await getFormAgentThread(db, workspaceId, formId);
    const messages = thread ? await listAgentMessages(db, workspaceId, thread.id) : [];
    const changeSets = [];
    for (const item of messages) {
      if (!item.changeSetId) continue;
      try {
        const changeSet = await getAgentChangeSet(db, workspaceId, formId, item.changeSetId);
        changeSets.push({
          id: changeSet.id,
          status: changeSet.status,
          summary: changeSet.summary,
          details: changeSet.details ?? [],
          baseDraftRevision: changeSet.baseDraftRevision,
        });
      } catch {
        // Proposal may have been removed; keep the conversation text.
      }
    }
    return {
      record,
      publishedSnapshot: published ? { schema: published.schema, identity: published.clientIdentityMapping ?? null, reviewRules: published.reviewRules ?? null } : null,
      draft,
      activeVersionNumber: active?.versionNumber ?? null,
      versions: versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        publishedAt: version.publishedAt.toISOString(),
      })),
      messages: messages.map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        changeSetId: item.changeSetId,
      })),
      changeSets,
    };
  } catch (error) {
    if (error instanceof FormServiceError && error.status === 404) return null;
    throw error;
  }
}
