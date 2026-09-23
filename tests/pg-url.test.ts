import { describe, expect, it } from "vitest";
import { pgConnectionString } from "@/lib/db/pg-url";

describe("pgConnectionString", () => {
  it("rewrites require prefer and verify-ca to verify-full", () => {
    const base = "postgresql://u:p@example.com/db";
    expect(pgConnectionString(`${base}?sslmode=require`)).toContain("sslmode=verify-full");
    expect(pgConnectionString(`${base}?sslmode=prefer`)).toContain("sslmode=verify-full");
    expect(pgConnectionString(`${base}?sslmode=verify-ca`)).toContain("sslmode=verify-full");
  });

  it("leaves verify-full unchanged", () => {
    const url = "postgresql://u:p@example.com/db?sslmode=verify-full";
    expect(pgConnectionString(url)).toContain("sslmode=verify-full");
  });
});
