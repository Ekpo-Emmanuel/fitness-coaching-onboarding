import { and, eq } from "drizzle-orm";
import { client } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";
import { normalizeEmail } from "@/lib/forms/identity";

export type ClientIdentityInput = {
  fullName: string;
  email: string;
  normalizedEmail: string;
  phone?: string | null;
};

export type ClientResolution = "created" | "reused" | "ambiguous_created";

export async function resolveOrCreateClient(
  db: Pick<FormsDatabase, "select" | "insert" | "update">,
  workspaceId: string,
  identity: ClientIdentityInput,
) {
  const matches = await db
    .select()
    .from(client)
    .where(and(eq(client.workspaceId, workspaceId), eq(client.normalizedEmail, identity.normalizedEmail)));

  if (matches.length === 1) {
    const existing = matches[0];
    const nextName = identity.fullName || existing.fullName;
    const nextPhone = identity.phone || existing.phone;
    const [updated] = await db
      .update(client)
      .set({
        fullName: nextName,
        email: identity.email,
        phone: nextPhone,
        updatedAt: new Date(),
      })
      .where(eq(client.id, existing.id))
      .returning();
    return { client: updated, resolution: "reused" as const };
  }

  const [created] = await db
    .insert(client)
    .values({
      workspaceId,
      fullName: identity.fullName,
      email: identity.email,
      normalizedEmail: identity.normalizedEmail || normalizeEmail(identity.email),
      phone: identity.phone ?? null,
    })
    .returning();
  return {
    client: created,
    resolution: (matches.length > 1 ? "ambiguous_created" : "created") as ClientResolution,
  };
}
