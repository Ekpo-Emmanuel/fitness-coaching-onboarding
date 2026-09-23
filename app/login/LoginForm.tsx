"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const router = useRouter();
  const mode = initialMode;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result =
      mode === "signup"
        ? await authClient.signUp.email({
            name: name.trim() || email,
            email,
            password,
            callbackURL: "/onboarding",
          })
        : await authClient.signIn.email({
            email,
            password,
            callbackURL: "/dashboard",
          });

    if (result.error) {
      setError(result.error.message || "Could not authenticate.");
      setLoading(false);
      return;
    }

    router.push(mode === "signup" ? "/onboarding" : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {mode === "signup" ? (
        <label className="flex flex-col gap-2">
          <span className="font-display text-base tracking-tight">Your name</span>
          <input
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent"
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-2">
        <span className="font-display text-base tracking-tight">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-display text-base tracking-tight">Password</span>
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent"
        />
      </label>
      {error ? (
        <p className="text-warn" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="min-h-12 rounded-full bg-accent font-display tracking-tight text-surface active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
