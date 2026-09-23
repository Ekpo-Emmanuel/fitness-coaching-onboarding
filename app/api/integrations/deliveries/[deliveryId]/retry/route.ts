import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import { retryDelivery } from "@/lib/integrations/service";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export async function POST(_request: Request, context: { params: Promise<{ deliveryId: string }> }) {
  const { deliveryId } = await context.params;
  try {
    const session = await requireWorkspaceApi();
    const delivery = await retryDelivery(getPoolDb(), session.workspace.id, deliveryId);
    return NextResponse.json({ ok: true, status: delivery.status, lastError: delivery.lastError });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FormServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not retry that delivery." }, { status: 400 });
  }
}
