import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { FormServiceError } from "@/lib/forms/errors";

const COOKIE = "google_oauth_state";
const MAX_AGE_MS = 10 * 60 * 1000;

type OAuthState = {
  workspaceId: string;
  userId: string;
  nonce: string;
  exp: number;
};

function secret() {
  return process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || process.env.BETTER_AUTH_SECRET?.trim() || "";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createOAuthState(workspaceId: string, userId: string) {
  const payload: OAuthState = {
    workspaceId,
    userId,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + MAX_AGE_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readOAuthState(raw: string | undefined, workspaceId: string, userId: string) {
  if (!raw || !secret()) throw new FormServiceError("Google connection expired. Try again.");
  const [encoded, mac] = raw.split(".");
  if (!encoded || !mac) throw new FormServiceError("Google connection expired. Try again.");
  const expected = sign(encoded);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new FormServiceError("Google connection expired. Try again.");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
  if (payload.exp < Date.now()) throw new FormServiceError("Google connection expired. Try again.");
  if (payload.workspaceId !== workspaceId || payload.userId !== userId) {
    throw new FormServiceError("Google connection expired. Try again.");
  }
  return payload;
}

export const oauthStateCookie = COOKIE;
