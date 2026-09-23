import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { coachingProfile, workspace, workspaceMember } from "@/lib/db/schema";

export class WorkspaceAuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 | 503,
  ) {
    super(message);
    this.name = "WorkspaceAuthError";
  }
}

export async function getSessionUser() {
  await connection();
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function getWorkspaceContext() {
  const user = await getSessionUser();
  if (!user) return null;

  const db = getDb();
  const membershipRows = await db
    .select({
      member: workspaceMember,
      workspace,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(eq(workspaceMember.userId, user.id))
    .limit(1);

  const membership = membershipRows[0];
  if (!membership) {
    return { user, workspace: null, membership: null, profile: null };
  }

  const profiles = await db
    .select()
    .from(coachingProfile)
    .where(eq(coachingProfile.workspaceId, membership.workspace.id))
    .limit(1);

  return {
    user,
    workspace: membership.workspace,
    membership: membership.member,
    profile: profiles[0] ?? null,
  };
}

export async function requireWorkspace() {
  const context = await getWorkspaceContext();
  if (!context?.user) redirect("/login");
  if (!context.workspace || !context.membership || !context.profile) {
    redirect("/onboarding");
  }
  return {
    user: context.user,
    workspace: context.workspace,
    membership: context.membership,
    profile: context.profile,
  };
}

export async function requireWorkspaceApi() {
  try {
    const context = await getWorkspaceContext();
    if (!context?.user) {
      throw new WorkspaceAuthError("Unauthorized", 401);
    }
    if (!context.workspace || !context.membership || !context.profile) {
      throw new WorkspaceAuthError("Workspace setup is incomplete.", 403);
    }
    return {
      user: context.user,
      workspace: context.workspace,
      membership: context.membership,
      profile: context.profile,
    };
  } catch (error) {
    if (error instanceof WorkspaceAuthError) throw error;
    throw new WorkspaceAuthError("Workspace is unavailable.", 503);
  }
}
