import type { EstimatedMinutes } from "./types";

export function formatEstimatedMinutes(value?: EstimatedMinutes) {
  if (!value) return "";
  if (value.max != null && value.max !== value.min) return `${value.min}–${value.max}`;
  return String(value.min);
}
