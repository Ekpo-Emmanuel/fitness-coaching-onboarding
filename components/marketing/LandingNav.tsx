"use client";

import Link from "next/link";
import { useId, useState } from "react";

const sections = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#connections", label: "Connections" },
] as const;

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-lg tracking-tight">
          Coaching
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Product">
          {sections.map((item) => (
            <a key={item.href} href={item.href} className="text-muted underline-offset-4 hover:text-ink hover:underline">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex min-h-12 items-center rounded-full bg-accent px-5 font-display text-surface"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="inline-flex min-h-12 items-center px-3 text-sm text-muted hover:text-ink">
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center rounded-full bg-accent px-5 font-display text-surface"
              >
                Get started
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-line md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span aria-hidden className="flex flex-col gap-1.5">
            <span className={`block h-0.5 w-5 bg-ink transition ${open ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 bg-ink transition ${open ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-ink transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </span>
        </button>
      </div>
      {open ? (
        <div id={menuId} className="border-t border-line bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {sections.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="min-h-12 px-1 py-3 text-ink"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            {signedIn ? (
              <Link href="/dashboard" className="min-h-12 py-3 font-display text-accent">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="min-h-12 py-3 text-ink">
                  Log in
                </Link>
                <Link href="/signup" className="min-h-12 py-3 font-display text-accent">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
