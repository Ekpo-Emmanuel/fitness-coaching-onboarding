import { NextResponse } from "next/server";
import { healthOk } from "@/lib/ops/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return healthOk();
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
