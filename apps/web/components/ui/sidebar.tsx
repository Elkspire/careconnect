"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Replaces .dash-shell/.dash-sidebar/.dash-navlink — the sidebar portal
 * shell used by the patient and clinic dashboards. Unlike the legacy
 * version, SidebarLink actually highlights the active route (the legacy
 * .dash-navlink.on class exists in CSS but neither portal layout ever
 * applied it).
 */
export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">{children}</div>
  );
}

export function SidebarNav({ children }: { children: ReactNode }) {
  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-2 md:w-56 md:flex-col md:overflow-visible">
      {children}
    </nav>
  );
}

export function SidebarLink({
  href,
  icon,
  label,
}: {
  href: string;
  // A rendered element, not a component reference — a bare component type
  // (e.g. passing the LucideIcon function itself) can't cross the server
  // Component -> Client Component boundary this component sits on, since
  // function values aren't serializable. Server callers pass
  // `<Icon aria-hidden className="..." />` here, not `icon={Icon}`.
  icon: ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-3 rounded-md border-s-2 px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "border-s-primary-600 bg-primary-50 text-primary-800"
          : "border-s-transparent text-text-muted hover:bg-surface-muted hover:text-text"
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

export function SidebarMain({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1">{children}</div>;
}
