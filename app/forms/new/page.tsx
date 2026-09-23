import { PageHeader } from "@/components/product/ui";
import { AppShell } from "@/components/product/AppShell";
import { NewFormForm } from "./NewFormForm";
import { requireWorkspace } from "@/lib/workspace/session";

export const dynamic = "force-dynamic";

export default async function NewFormPage() {
  const { profile } = await requireWorkspace();
  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <PageHeader
          eyebrow="Forms / New onboarding"
          title="A thoughtful start."
          description="Choose how you want to build your client onboarding."
        />
        <div className="create-layout">
          <NewFormForm />
          <aside>
            <p className="eyebrow">Your form, your approach</p>
            <h2>Start with what matters.</h2>
            <p>
              Collect the context you need to understand your client before your
              first conversation.
            </p>
            <ol className="workflow-list">
              <li>Choose a starting point</li>
              <li>Refine your questions</li>
              <li>Preview and publish</li>
            </ol>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
