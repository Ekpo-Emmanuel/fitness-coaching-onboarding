import { getPoolDb } from "@/lib/db/node";
import { SchemaParseError } from "@/lib/forms/errors";
import { getPublicBranding } from "@/lib/forms/public-branding";
import { getPublishedFormBySlug } from "@/lib/forms/service";
import { PublicForm } from "./PublicForm";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const published = await loadPublished(slug);
  if (!published) return <Unavailable />;
  return (
    <PublicForm
      slug={slug}
      schema={published.schema}
      branding={published.branding}
      formId={published.formId}
      formVersionId={published.formVersionId}
      canCollect={published.canCollect}
    />
  );
}

async function loadPublished(slug: string) {
  try {
    const published = await getPublishedFormBySlug(getPoolDb(), slug);
    if (!published) return null;
    const branding = await getPublicBranding(getPoolDb(), published.workspaceId);
    return {
      schema: published.schema,
      branding,
      formId: published.formId,
      formVersionId: published.formVersionId,
      canCollect: published.canCollect,
    };
  } catch (error) {
    if (error instanceof SchemaParseError) return null;
    return null;
  }
}

function Unavailable() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center px-4">
      <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">Onboarding</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">This form is unavailable</h1>
      <p className="mt-3 text-muted">The onboarding link may be unpublished or no longer active.</p>
    </main>
  );
}
