export function toSnakeKey(label: string) {
  const key = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/[\s]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 48)
    .replace(/^_|_$/g, "");
  return key || "question";
}

export function uniqueKey(base: string, used: Set<string>) {
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

export function newEntityId(prefix: "fld" | "sec" | "sch" | "rule") {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
