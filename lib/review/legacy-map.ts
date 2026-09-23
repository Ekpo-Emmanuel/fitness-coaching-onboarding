import { V1_REVIEW_RULES } from "./v1-rules";
import type { ReviewFlagCandidate } from "./types";

export function flagsFromLegacyReasons(reasons: string[] | undefined): ReviewFlagCandidate[] {
  if (!reasons?.length) return [];
  const byCode = new Map(V1_REVIEW_RULES.rules.map((rule) => [rule.code, rule]));
  const flags: ReviewFlagCandidate[] = [];
  const seen = new Set<string>();
  for (const reason of reasons) {
    const rule = byCode.get(reason);
    if (!rule || seen.has(rule.code)) continue;
    seen.add(rule.code);
    flags.push({
      ruleId: rule.id,
      code: rule.code,
      label: rule.label,
      sourceFieldKeys: rule.sourceFieldKeys,
    });
  }
  return flags;
}
