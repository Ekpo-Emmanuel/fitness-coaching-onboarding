import fs from "node:fs";
import path from "node:path";

const payload = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "test-onboarding-payload.json"), "utf8"),
);
const response = await fetch("http://localhost:3000/api/onboarding", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const text = await response.text();
console.log("status", response.status);
console.log(text);
