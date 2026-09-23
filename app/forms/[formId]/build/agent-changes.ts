export type ChangeKind = "add" | "remove" | "update" | "move" | "other";

export type ParsedChange = { kind: ChangeKind; verb: string; label: string; destructive: boolean };

const PATTERNS: Array<{ match: RegExp; kind: ChangeKind; verb: string; destructive?: boolean }> = [
  { match: /^added section:\s*/i, kind: "add", verb: "Add section" },
  { match: /^added question:\s*/i, kind: "add", verb: "Add" },
  { match: /^replaced:\s*/i, kind: "update", verb: "Replace" },
  { match: /^added review rule:\s*/i, kind: "add", verb: "Add review rule" },
  { match: /^removed section:\s*/i, kind: "remove", verb: "Remove section", destructive: true },
  { match: /^removed review rule:\s*/i, kind: "remove", verb: "Remove review rule" },
  { match: /^removed:\s*/i, kind: "remove", verb: "Remove" },
  { match: /^moved section:\s*/i, kind: "move", verb: "Move section" },
  { match: /^moved question:\s*/i, kind: "move", verb: "Move" },
  { match: /^updated intro:\s*/i, kind: "update", verb: "Update intro" },
  { match: /^updated success:\s*/i, kind: "update", verb: "Update success" },
  { match: /^updated section:\s*/i, kind: "update", verb: "Update section" },
  { match: /^updated choices:\s*/i, kind: "update", verb: "Update choices" },
  { match: /^updated validation:\s*/i, kind: "update", verb: "Update validation" },
  { match: /^updated show-when:\s*/i, kind: "update", verb: "Update visibility" },
  { match: /^cleared show-when:\s*/i, kind: "update", verb: "Clear visibility" },
  { match: /^updated review rule:\s*/i, kind: "update", verb: "Update review rule" },
  { match: /^updated:\s*/i, kind: "update", verb: "Update" },
  { match: /^updated form details/i, kind: "update", verb: "Update form" },
  { match: /^updated client identity/i, kind: "update", verb: "Update identity" },
];

export function parseChangeDetails(details: string[]): ParsedChange[] {
  return details.filter(Boolean).map((line) => {
    const pattern = PATTERNS.find((item) => item.match.test(line));
    if (!pattern) return { kind: "other" as const, verb: "Change", label: line, destructive: false };
    return {
      kind: pattern.kind,
      verb: pattern.verb,
      label: line.replace(pattern.match, "").trim() || line,
      destructive: Boolean(pattern.destructive),
    };
  });
}

export function isDestructiveProposal(details: string[]) {
  return parseChangeDetails(details).some((item) => item.destructive);
}
