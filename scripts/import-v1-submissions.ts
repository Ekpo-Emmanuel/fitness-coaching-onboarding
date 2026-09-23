import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { getPoolDb } from "../lib/db/node";
import { user, workspaceMember } from "../lib/db/schema";
import { listOnboardingResponses } from "../lib/sheets/repository";
import { importV1Submissions } from "../lib/submissions/import-v1";

loadEnvConfig(process.cwd());

function arg(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((item) => item.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function main() {
  const email = arg("email");
  const workspaceIdArg = arg("workspace");
  const commit = process.argv.includes("--commit");
  const dryRun = process.argv.includes("--dry-run") || !commit;
  if (!email && !workspaceIdArg) {
    throw new Error("Pass --email=<owner email> or --workspace=<workspace id>.");
  }

  const db = getPoolDb();
  let workspaceId = workspaceIdArg;
  if (email) {
    const users = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (!users[0]) throw new Error(`No user for ${email}.`);
    const memberships = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.userId, users[0].id))
      .limit(1);
    if (!memberships[0]) throw new Error("That user has no workspace.");
    workspaceId = memberships[0].workspaceId;
  }

  const rows = await listOnboardingResponses();
  const report = await importV1Submissions(db, {
    workspaceId: workspaceId!,
    rows,
    commit: !dryRun,
  });
  console.log(JSON.stringify({ dryRun, ...report }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
