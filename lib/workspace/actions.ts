"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { coachingProfile, workspace, workspaceMember } from "@/lib/db/schema";
import { parseCoachingProfileInput } from "@/lib/workspace/profile";
import { getWorkspaceContext, requireUser, requireWorkspace } from "@/lib/workspace/session";

export async function completeCoachSetup(input: unknown) {
  const user = await requireUser();
  const parsed = parseCoachingProfileInput(input);
  if (parsed.error || !parsed.data) {
    return { error: parsed.error || "Could not save your setup." };
  }

  const existing = await getWorkspaceContext();
  if (existing?.workspace && existing.profile) {
    redirect("/dashboard");
  }

  const data = parsed.data;
  const db = getDb();
  const [createdWorkspace] = await db
    .insert(workspace)
    .values({ name: data.businessName })
    .returning();

  await db.insert(workspaceMember).values({
    workspaceId: createdWorkspace.id,
    userId: user.id,
    role: "owner",
  });

  await db.insert(coachingProfile).values({
    workspaceId: createdWorkspace.id,
    businessName: data.businessName,
    coachName: data.coachName,
    coachingTypes: data.coachingTypes,
    targetClientDescription: data.targetClientDescription,
    providesNutritionCoaching: data.providesNutritionCoaching,
    requiresHealthScreening: data.requiresHealthScreening,
    coachingPhilosophy: data.coachingPhilosophy || null,
    programmingConsiderations: data.programmingConsiderations || null,
  });

  redirect("/dashboard");
}

export async function updateCoachingProfile(input: unknown) {
  const context = await requireWorkspace();
  const parsed = parseCoachingProfileInput(input);
  if (parsed.error || !parsed.data) {
    return { error: parsed.error || "Could not save your profile." };
  }

  const data = parsed.data;
  const db = getDb();
  await db
    .update(coachingProfile)
    .set({
      businessName: data.businessName,
      coachName: data.coachName,
      coachingTypes: data.coachingTypes,
      targetClientDescription: data.targetClientDescription,
      providesNutritionCoaching: data.providesNutritionCoaching,
      requiresHealthScreening: data.requiresHealthScreening,
      coachingPhilosophy: data.coachingPhilosophy || null,
      programmingConsiderations: data.programmingConsiderations || null,
      updatedAt: new Date(),
    })
    .where(eq(coachingProfile.workspaceId, context.workspace.id));

  await db
    .update(workspace)
    .set({ name: data.businessName, updatedAt: new Date() })
    .where(eq(workspace.id, context.workspace.id));

  return { ok: true as const };
}
