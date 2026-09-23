import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { getPoolDb } from "../lib/db/node";
import { user, workspaceMember } from "../lib/db/schema";
import { seedV1Form } from "../lib/forms/service";
import { emmanuelOnboardingV1 } from "../lib/onboarding/schemas/emmanuel-onboarding-v1";

loadEnvConfig(process.cwd());

function arg(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((item) => item.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function main() {
  const email = arg("email");
  const workspaceId = arg("workspace");
  if (!email && !workspaceId) {
    throw new Error("Pass --email=<owner email> or --workspace=<workspace id>.");
  }

  const db = getPoolDb();
  let resolvedWorkspaceId = workspaceId;
  let userId: string | undefined;

  if (email) {
    const users = await db.select().from(user).where(eq(user.email, email)).limit(1);
    const owner = users[0];
    if (!owner) throw new Error(`No user for ${email}.`);
    userId = owner.id;
    const memberships = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.userId, owner.id))
      .limit(1);
    if (!memberships[0]) throw new Error("That user has no workspace.");
    resolvedWorkspaceId = memberships[0].workspaceId;
  } else if (workspaceId) {
    const memberships = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, workspaceId))
      .limit(1);
    if (!memberships[0]) throw new Error("Workspace has no members.");
    userId = memberships[0].userId;
    resolvedWorkspaceId = workspaceId;
  }

  if (!resolvedWorkspaceId || !userId) throw new Error("Could not resolve workspace.");

  const result = await seedV1Form(db, {
    workspaceId: resolvedWorkspaceId,
    userId,
    schema: emmanuelOnboardingV1,
  });
  console.log(
    JSON.stringify(
      {
        created: result.created,
        formId: result.form.id,
        slug: result.form.slug,
        status: result.form.status,
        activePublishedVersionId: result.form.activePublishedVersionId,
        versionCount: result.versions.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
