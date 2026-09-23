import { NextResponse } from "next/server";
/** V1 compatibility: legacy public POST used by the unmounted V1 renderer. Do not create V2 IntegrationDeliveries here. */
import { SheetsConfigError } from "@/lib/sheets/client";
import { submitOnboarding } from "@/lib/onboarding/service";
import { ValidationError, validateSubmission } from "@/lib/onboarding/validate";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  try {
    const data = validateSubmission(payload);
    const saved = await submitOnboarding(data);
    return NextResponse.json({
      ok: true,
      submission_id: saved.submission_id,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Check the highlighted answers.", fields: error.fields }, { status: 400 });
    }
    if (error instanceof SheetsConfigError) {
      return NextResponse.json(
        { error: "We couldn't submit your onboarding just yet. Your answers are still here. Please try again." },
        { status: 503 },
      );
    }
    console.error("onboarding_submit_failed");
    return NextResponse.json(
      { error: "We couldn't submit your onboarding just yet. Your answers are still here. Please try again." },
      { status: 502 },
    );
  }
}
