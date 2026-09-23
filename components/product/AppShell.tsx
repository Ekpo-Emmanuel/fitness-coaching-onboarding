"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SquaresFour,
  Files,
  Users,
  PlugsConnected,
  GearSix,
} from "@phosphor-icons/react";
import { Brand } from "./Brand";
import type { ReactNode } from "react";
import { SignOutButton } from "./SignOutButton";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { href: "/forms", label: "Forms", icon: Files },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings/connections", label: "Connections", icon: PlugsConnected },
  { href: "/settings", label: "Settings", icon: GearSix },
] as const;

export function AppShell({
  children,
  businessName,
  activePath,
}: {
  children: ReactNode;
  businessName?: string;
  activePath?: string;
}) {
  const pathname = usePathname();
  const path = activePath ?? pathname;
  const current = nav.find((item) =>
    item.href === "/settings"
      ? path === "/settings" || path.startsWith("/settings/profile")
      : path.startsWith(item.href),
  );
  return (
    <div
      className={`app-shell ${path.endsWith("/build") ? "app-shell-builder" : ""}`}
    >
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      <aside className="app-sidebar">
        <Link href="/dashboard" aria-label="Coaching dashboard">
          <Brand />
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {(businessName || "C").slice(0, 1)}
          </span>
          <div>
            <strong>{businessName || "Your workspace"}</strong>
            <span>Coach workspace</span>
          </div>
        </div>
        <p className="eyebrow nav-eyebrow">Workspace</p>
        <nav className="app-nav" aria-label="Main navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={current?.href === href ? "page" : undefined}
            >
              <Icon
                size={21}
                weight={current?.href === href ? "fill" : "regular"}
              />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <SignOutButton />
        </div>
      </aside>
      <div className="app-workspace">
        <header className="workspace-topbar">
          <span>{current?.label || "Workspace"}</span>
          <span className="workspace-topbar-note">
            Built around your coaching
          </span>
          <Link
            href="/settings/profile"
            aria-label="Your coaching profile"
            className="workspace-avatar"
          >
            {(businessName || "C").slice(0, 1)}
          </Link>
        </header>
        <div id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}
