"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

export interface ShellNavItem {
  href: string;
  label: string;
  /** A rendered icon element (a component can't cross into a client component). */
  icon: ReactNode;
  /** Shown as an amber count, like the prototypes' "Onboarding 6". */
  badge?: number;
  /** Also active on pages under href (default), or only on href itself. */
  exact?: boolean;
}

/**
 * The navy sidebar's links, or the front desk's icon rail ("rail": icon over
 * a short label). The current page is highlighted teal and marked
 * aria-current.
 */
export function ShellNav({
  items,
  label,
  variant = "sidebar",
}: {
  items: ShellNavItem[];
  label: string;
  variant?: "sidebar" | "rail";
}) {
  const pathname = usePathname();
  const isActive = (item: ShellNavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <nav aria-label={label} className="min-w-0">
      <ul
        className={
          variant === "rail"
            ? "flex gap-1.5 overflow-x-auto md:flex-col md:items-center md:overflow-visible"
            : "flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
        }
      >
        {items.map((item) => {
          const active = isActive(item);
          const tone = active
            ? "bg-primary-600 text-text-on-primary"
            : "text-navy-fg hover:bg-navy-hover hover:text-white";
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  variant === "rail"
                    ? `relative flex min-h-16 w-20 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold no-underline transition ${tone}`
                    : `tap-target flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium no-underline transition ${tone}`
                }
              >
                {item.icon}
                <span
                  title={variant === "rail" ? undefined : item.label}
                  className={variant === "rail" ? "text-center leading-tight" : "min-w-0 truncate"}
                >
                  {item.label}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`shrink-0 rounded-full bg-[#f79009] px-2 text-[11px] font-bold text-[#0f1b2d] tabular-nums ${
                      variant === "rail" ? "absolute end-3 top-1.5" : "ms-auto"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
