import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "./db";
import * as schema from "./db/schema";

function authSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not configured.");
  }
  return secret;
}

function createAuth() {
  return betterAuth({
    secret: authSecret(),
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [
      process.env.BETTER_AUTH_URL || "http://localhost:3000",
      ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://127.0.0.1:3000"]),
    ].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index),
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [nextCookies()],
  });
}

type AuthInstance = ReturnType<typeof createAuth>;

let cached: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (!cached) cached = createAuth();
  return cached;
}
