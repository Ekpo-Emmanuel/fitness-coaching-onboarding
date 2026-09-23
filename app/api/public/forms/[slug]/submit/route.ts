import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import { log, requestIdFrom } from "@/lib/observability/log";
import { submitPublishedForm } from "@/lib/submissions/service";
import { ValidationError } from "@/lib/onboarding/schema/engine";
import { clientIp, publicSubmitRateLimiter, submitRateKey } from "@/lib/security/rate-limit";
import { assertBotSignals, assertPayloadSize, parseSubmissionAttemptId } from "@/lib/security/payload";
import { trustProxy } from "@/lib/config";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const requestId = requestIdFrom(request);
  const limited = await publicSubmitRateLimiter().take(submitRateKey(clientIp(request, trustProxy()), slug));
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  let raw = "";
  try {
    raw = await request.text();
    assertPayloadSize(raw);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Check the highlighted answers.", fields: error.fields }, { status: 400 });
    }
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const answers = "answers" in body ? body.answers : payload;
  try {
    const submissionAttemptId = parseSubmissionAttemptId(body.submissionAttemptId);
    assertBotSignals({ honeypot: body.website, startedAt: body.startedAt });
    const saved = await submitPublishedForm(getPoolDb(), { slug, answers, submissionAttemptId });
    return NextResponse.json({ ok: true, submission_id: saved.submissionId, request_id: requestId });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Check the highlighted answers.", fields: error.fields }, { status: 400 });
    }
    if (error instanceof FormServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status === 403 ? 403 : error.status });
    }
    log.error("public_form_submit_failed", { slug, requestId });
    return NextResponse.json(
      { error: "We couldn't submit your onboarding just yet. Your answers are still here. Please try again." },
      { status: 502 },
    );
  }
}
