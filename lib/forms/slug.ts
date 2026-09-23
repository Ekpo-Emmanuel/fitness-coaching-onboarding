const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomSuffix(length = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function slugifyName(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
    .replace(/^-|-$/g, "");
  return base || "onboarding";
}

export function createFormSlug(name: string) {
  return `${slugifyName(name)}-${randomSuffix()}`;
}

export function createReservedSlug(preferred: string) {
  return slugifyName(preferred);
}
