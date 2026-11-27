import { HeartPulse } from "lucide-react";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { InitialsAvatar } from "@/components/ui/avatar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { ShellNav, type ShellNavItem } from "./shell-nav";

export interface ShellUser {
  name: string;
  /** e.g. "Owner · Khan Skin Clinic". */
  role: string;
}

/**
 * The workspace frame from the prototypes (clinic, front desk, admin,
 * partner): a full-height navy sidebar — or, for the front desk, a narrow
 * icon rail — beside a white top bar with the workspace title and the
 * signed-in user. Replaces the public site header on these pages. On a
 * phone the sidebar becomes a scrollable strip across the top.
 */
export async function AppShell({
  variant = "sidebar",
  subtitle,
  nav,
  navLabel,
  sidebarTop,
  sidebarFooter,
  title,
  description,
  actions,
  user,
  home,
  children,
}: {
  variant?: "sidebar" | "rail";
  /** Under the brand, e.g. "Clinic workspace". */
  subtitle: string;
  nav: ShellNavItem[];
  navLabel: string;
  /** Above the nav, e.g. the partner portal's Lab / Pharmacy switch. */
  sidebarTop?: ReactNode;
  /** Pinned to the bottom of the sidebar, e.g. the branch switcher. */
  sidebarFooter?: ReactNode;
  /** The top bar's heading, e.g. the clinic name. */
  title: string;
  description?: string;
  actions?: ReactNode;
  user: ShellUser;
  /** Where the logo goes. */
  home: string;
  children: ReactNode;
}) {
  const t = await getTranslations("site");
  const rail = variant === "rail";

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside
        className={`flex shrink-0 flex-col gap-4 bg-navy px-3 py-3 text-white md:sticky md:top-0 md:h-screen md:overflow-y-auto md:py-5 ${
          rail ? "md:w-24 md:items-center md:px-2" : "md:w-[236px] md:gap-5 md:px-3.5"
        }`}
      >
        <Link
          href={home}
          className={`flex items-center gap-2.5 text-white no-underline ${rail ? "md:justify-center" : "px-1.5"}`}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-600 text-text-on-primary">
            <HeartPulse aria-hidden className="size-5" />
          </span>
          <span className={rail ? "md:sr-only" : ""}>
            <b className="block font-display text-lg leading-tight font-extrabold">CareConnect</b>
            <span className="block text-xs text-[#7fe3da]">{subtitle}</span>
          </span>
        </Link>
        {sidebarTop}
        <ShellNav items={nav} label={navLabel} variant={variant} />
        {sidebarFooter && <div className="mt-auto hidden md:block">{sidebarFooter}</div>}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface/70 px-4 py-3 backdrop-blur-[14px] sm:px-7 sm:py-4">
          <div className="me-auto min-w-0">
            <p className="truncate font-display text-lg font-bold text-text sm:text-[22px]">{title}</p>
            {description && <p className="truncate text-xs text-text-muted">{description}</p>}
          </div>
          {actions}
          <LanguageSwitcher label={t("language")} />
          <div className="flex items-center gap-2.5">
            <InitialsAvatar name={user.name} size="sm" />
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="truncate text-sm font-semibold text-text">{user.name}</p>
              <p className="truncate text-xs text-text-muted">{user.role}</p>
            </div>
          </div>
          <LogoutButton />
        </header>
        <main className="w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-7">{children}</main>
      </div>
    </div>
  );
}
