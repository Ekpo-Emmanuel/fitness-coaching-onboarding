"use client";
import { identityFieldOptions } from "@/lib/forms/identity";
import type { BuilderDraft } from "./useBuilderDraft";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { ClientIdentityMapping } from "@/lib/forms/identity";
export function FormSettings({ draft, onChange }: { draft: BuilderDraft; onChange: (next: BuilderDraft) => void }) {
 const { schema, identity } = draft;
 const queueSave = (schema: OnboardingSchema, identity: ClientIdentityMapping | null = draft.identity) => onChange({ ...draft, schema, identity });
 return <div className="bw-form-settings"><label>Form name<input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
          <div className="mt-8 grid max-w-2xl gap-4">
            <label>
              Title
              <input
                className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
                value={schema.title}
                onChange={(event) => queueSave({ ...schema, title: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
                value={schema.description ?? ""}
                onChange={(event) => queueSave({ ...schema, description: event.target.value })}
              />
            </label>
            <label>
              Intro title
              <input
                className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
                value={schema.intro.title}
                onChange={(event) => queueSave({ ...schema, intro: { ...schema.intro, title: event.target.value } })}
              />
            </label>
            <label>
              Intro text
              <textarea
                className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
                value={schema.intro.description.join("\n\n")}
                onChange={(event) =>
                  queueSave({
                    ...schema,
                    intro: { ...schema.intro, description: event.target.value.split(/\n\n+/) },
                  })
                }
              />
            </label>
            <label>
              Success title
              <input
                className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
                value={schema.success.title}
                onChange={(event) => queueSave({ ...schema, success: { ...schema.success, title: event.target.value } })}
              />
            </label>
            <label>
              Success message
              <textarea
                className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
                value={schema.success.message.join("\n\n")}
                onChange={(event) =>
                  queueSave({
                    ...schema,
                    success: { ...schema.success, message: event.target.value.split(/\n\n+/) },
                  })
                }
              />
            </label>
            <fieldset className="rounded-2xl border border-line p-4">
              <legend className="px-1 font-display">Client identity</legend>
              <p className="mb-3 text-sm text-muted">These questions create the client record when someone submits.</p>
              <label className="block">
                Client name question
                <select
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2"
                  value={identity?.fullNameFieldKey ?? ""}
                  onChange={(event) =>
                    queueSave(schema, {
                      fullNameFieldKey: event.target.value,
                      emailFieldKey: identity?.emailFieldKey ?? "",
                      phoneFieldKey: identity?.phoneFieldKey,
                    })
                  }
                >
                  <option value="">Select a question</option>
                  {identityFieldOptions(schema, "name").map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                Client email question
                <select
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2"
                  value={identity?.emailFieldKey ?? ""}
                  onChange={(event) =>
                    queueSave(schema, {
                      fullNameFieldKey: identity?.fullNameFieldKey ?? "",
                      emailFieldKey: event.target.value,
                      phoneFieldKey: identity?.phoneFieldKey,
                    })
                  }
                >
                  <option value="">Select a question</option>
                  {identityFieldOptions(schema, "email").map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                Client phone question — optional
                <select
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2"
                  value={identity?.phoneFieldKey ?? ""}
                  onChange={(event) =>
                    queueSave(schema, {
                      fullNameFieldKey: identity?.fullNameFieldKey ?? "",
                      emailFieldKey: identity?.emailFieldKey ?? "",
                      phoneFieldKey: event.target.value || null,
                    })
                  }
                >
                  <option value="">None</option>
                  {identityFieldOptions(schema, "phone").map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </div>
 </div>;
}
