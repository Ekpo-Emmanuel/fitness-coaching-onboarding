import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import { exportFormSubmissionsCsv } from "@/lib/privacy/service";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ formId: string }> }) {
  const { formId } = await context.params;
  try {
    const session = await requireWorkspaceApi();
    const csv = await exportFormSubmissionsCsv(getPoolDb(), session.workspace.id, formId);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="form-submissions-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof WorkspaceAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof FormServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not export submissions." }, { status: 400 });
  }
}
