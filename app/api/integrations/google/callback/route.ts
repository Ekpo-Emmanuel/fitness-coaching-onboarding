import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPoolDb } from "@/lib/db/node";
import { FormServiceError } from "@/lib/forms/errors";
import { exchangeGoogleCode } from "@/lib/integrations/google-oauth";
import { oauthStateCookie, readOAuthState } from "@/lib/integrations/oauth-state";
import { upsertGoogleIntegration } from "@/lib/integrations/service";
import { requireWorkspaceApi, WorkspaceAuthError } from "@/lib/workspace/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  try {
    const session = await requireWorkspaceApi();
    const jar = await cookies();
    const cookieState = jar.get(oauthStateCookie)?.value;
    readOAuthState(cookieState, session.workspace.id, session.user.id);
    if (!state || state !== cookieState) throw new FormServiceError("Google connection expired. Try again.");
    if (!code) throw new FormServiceError("Google did not return an authorization code.");
    const tokens = await exchangeGoogleCode(code);
    await upsertGoogleIntegration(getPoolDb(), session.workspace.id, tokens);
    const response = NextResponse.redirect(new URL("/settings/connections?google=connected", url.origin));
    response.cookies.delete(oauthStateCookie);
    return response;
  } catch (error) {
    const origin = url.origin;
    if (error instanceof WorkspaceAuthError) {
      const login = NextResponse.redirect(new URL("/login", origin));
      login.cookies.delete(oauthStateCookie);
      return login;
    }
    const response = NextResponse.redirect(new URL("/settings/connections?google=error", origin));
    response.cookies.delete(oauthStateCookie);
    return response;
  }
}
