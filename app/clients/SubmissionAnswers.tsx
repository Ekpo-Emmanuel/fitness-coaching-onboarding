import { parseOnboardingSchema } from "@/lib/forms/parse-schema";
import { visibleAnswerRows } from "@/lib/submissions/display";
import type { OnboardingAnswers, OnboardingSchema } from "@/lib/onboarding/schema/types";

export function SubmissionAnswers({
  schema,
  answers,
}: {
  schema: OnboardingSchema;
  answers: OnboardingAnswers;
}) {
  return (
    <div className="space-y-8">
      {schema.sections.map((section) => {
        const rows = visibleAnswerRows(section.fields, answers);
        if (rows.length === 0) return null;
        return (
          <section key={section.id}>
            <h2 className="font-display text-2xl tracking-tight">{section.title}</h2>
            <dl className="mt-4 space-y-4">
              {rows.map(({ field, value }) => (
                <div key={field.id} className="border-b border-line pb-3">
                  <dt className="text-sm text-muted">{field.label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

export function parseSubmissionSchema(schema: unknown): OnboardingSchema | null {
  try {
    return parseOnboardingSchema(schema);
  } catch {
    return null;
  }
}
