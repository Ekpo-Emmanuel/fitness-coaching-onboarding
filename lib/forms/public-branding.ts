import { eq } from "drizzle-orm";
import { coachingProfile } from "@/lib/db/schema";
import type { FormsDatabase } from "@/lib/db/node";

export async function getPublicBranding(db: FormsDatabase, workspaceId: string) {
  const rows = await db
    .select({
      businessName: coachingProfile.businessName,
      coachName: coachingProfile.coachName,
      primaryColor: coachingProfile.primaryColor,
    })
    .from(coachingProfile)
    .where(eq(coachingProfile.workspaceId, workspaceId))
    .limit(1);
  return rows[0] ?? { businessName: "Coaching", coachName: "Your coach", primaryColor: null };
}
