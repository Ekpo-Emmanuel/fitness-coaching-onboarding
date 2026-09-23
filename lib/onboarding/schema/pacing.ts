import type { FormField, OnboardingAnswers, OnboardingSchema } from "./types";
import { isFieldVisible } from "./visibility";

export type QuestionPage = { key: string; sectionIndex: number; fields: FormField[] };

/** Presentation only: never modifies the published schema or answer keys. */
export function questionPages(schema: OnboardingSchema): QuestionPage[] {
  return schema.sections.flatMap((section, sectionIndex) => {
    const blocks: FormField[][] = [];
    for (const field of section.fields) {
      const previous = blocks.at(-1);
      const dependencies = [...(field.logic?.all ?? []), ...(field.logic?.any ?? [])];
      const followsTrigger = previous && dependencies.some((condition) => previous.some((item) => item.key === condition.fieldKey));
      if (previous && (followsTrigger || (field.group && previous[0].group === field.group))) previous.push(field);
      else blocks.push([field]);
    }
    const pages: QuestionPage[] = [];
    let weight = 0;
    for (const block of blocks) {
      // Conditional details share their trigger's budget and appear inline.
      const cost = block.filter((field) => !field.logic).reduce((sum, field) =>
        sum + (field.type === "long_text" || field.type === "multi_select" || (field.type === "single_select" && field.options.length > 4) ? 2 : 1), 0) || 1;
      if (!pages.length || weight + cost > 4) {
        pages.push({ key: `${section.id}:${block[0].id}`, sectionIndex, fields: [] });
        weight = 0;
      }
      pages.at(-1)!.fields.push(...block);
      weight += cost;
    }
    return pages;
  });
}

export function visiblePages(pages: QuestionPage[], answers: OnboardingAnswers) {
  return pages.filter((page) => page.fields.some((field) => isFieldVisible(field, answers)));
}

export function pageHasError(page: QuestionPage, errors: Record<string, string>) {
  return page.fields.some((field) => errors[field.key] || (field.type === "unit_number" &&
    (errors[field.unitKey] || (field.companionKey && errors[field.companionKey]))));
}
