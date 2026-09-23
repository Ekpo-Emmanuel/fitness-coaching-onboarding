/** Responses API `json_object` rejects requests unless input (not only instructions) contains "json". */
export function jsonObjectInput(payload: unknown) {
  return `Respond with a JSON object.\n${JSON.stringify(payload)}`;
}
