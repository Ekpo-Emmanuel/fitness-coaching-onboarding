import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { cronSecret } from "@/lib/config";
import { runMaintenance } from "@/lib/ops/maintenance";
import { log } from "@/lib/observability/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorizedMaintenance(request: Request) {
  const expected = cronSecret();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runMaintenance(getPoolDb());
  log.info("maintenance_ran", { deliveries: result.deliveries, briefs: result.briefs });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return authorizedMaintenance(request);
}

/** Vercel Cron issues GET and sends Authorization: Bearer $CRON_SECRET when that env var is set. */
export async function GET(request: Request) {
  return authorizedMaintenance(request);
}
