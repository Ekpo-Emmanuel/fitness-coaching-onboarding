"use client";

import { useState } from "react";
import { AgentPanel } from "@/app/forms/[formId]/build/AgentPanel";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";

export function AgentSandbox() {
  const [title, setTitle] = useState("Sandbox onboarding");
  const schema = createBlankOnboardingSchema(title);
  return (
    <main className="min-h-[100dvh] bg-paper">
      <div className="grid min-h-[100dvh] lg:grid-cols-[26rem_minmax(0,1fr)]">
        <AgentPanel
          formId="00000000-0000-4000-8000-000000000099"
          initialMessages={[]}
          initialChangeSets={[]}
          schema={schema}
          onApplied={(next) => setTitle(next.schema.title)}
        />
        <section className="p-8">
          <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">Editor</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight">{title}</h1>
          <p className="mt-4 text-muted">Published version remains Version 1 in this sandbox.</p>
          <p className="mt-8 text-sm text-muted">Questions: {schema.sections.flatMap((section) => section.fields).length}</p>
        </section>
      </div>
    </main>
  );
}
