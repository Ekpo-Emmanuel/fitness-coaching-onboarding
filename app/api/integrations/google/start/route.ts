import { NextResponse } from "next/server";
import { createGoogleAuthUrl, googleOAuthConfigured } from "@/lib/integrations/google-oauth";
import { createOAuthState, oauthStateCookie } from "@/lib/integrations/oauth-state";
import { FormServiceError } from "@/lib/forms/errors";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export async function GET() {
  try {
    const session = await requireWorkspaceApi();
    if (!googleOAuthConfigured()) {
      return NextResponse.json({ error: "Google Sheets OAuth is not configured." }, { status: 503 });
    }
    const state = createOAuthState(session.workspace.id, session.user.id);
    const url = createGoogleAuthUrl(state);
    const response = NextResponse.redirect(url);
    response.cookies.set(oauthStateCookie, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FormServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not start Google connection." }, { status: 400 });
  }
}
