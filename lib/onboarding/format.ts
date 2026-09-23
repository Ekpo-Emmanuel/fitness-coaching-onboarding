import { labelOf } from "./constants";

export function formatList(values: string[]) {
  return values.length ? values.map(labelOf).join(", ") : "—";
}

export function formatAge(dateOfBirth: string) {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return String(age);
}

export function formatHeight(value: string, unit: string, inches: string) {
  if (unit === "ft_in") return `${value}'${inches || "0"}"`;
  return `${value} cm`;
}

export function formatWeight(value: string, unit: string) {
  return `${value} ${unit}`;
}
