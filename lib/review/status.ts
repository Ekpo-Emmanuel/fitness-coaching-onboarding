export function reviewStatusLabel(status: string | null | undefined) {
  if (status === "needs_review") return "Needs Review";
  if (status === "reviewed") return "Reviewed";
  if (status === "new") return "New";
  return "—";
}
