import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/product/AppShell";
import { getPoolDb } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import { getWorkspaceDraft, getWorkspaceForm } from "@/lib/forms/service";
import { requireWorkspace } from "@/lib/workspace/session";
import { FormPreview } from "./FormPreview";

export const dynamic = "force-dynamic";

export default async function PreviewFormPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const { workspace, profile } = await requireWorkspace();
  const loaded = await loadPreview(workspace.id, formId);
  if (!loaded) notFound();
  return (
    <AppShell businessName={profile.businessName}>
      <div className="border-b border-line px-4 py-3">
        <Link href={`/forms/${loaded.record.id}/build`} className="text-sm text-muted">
          Back to editor
        </Link>
      </div>
      <FormPreview
        schema={loaded.draft.schema}
        branding={{
          businessName: profile.businessName,
          coachName: profile.coachName,
          primaryColor: profile.primaryColor,
        }}
      />
    </AppShell>
  );
}

async function loadPreview(workspaceId: string, formId: string) {
  const db = getPoolDb();
  try {
    const record = await getWorkspaceForm(db, workspaceId, formId);
    const draft = await getWorkspaceDraft(db, workspaceId, formId);
    return { record, draft };
  } catch (error) {
    if (error instanceof FormServiceError && error.status === 404) return null;
    throw error;
  }
}
