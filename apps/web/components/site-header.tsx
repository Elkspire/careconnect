import { Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function SiteHeader() {
  const [t, tPatient, supabase] = await Promise.all([
    getTranslations("site"),
    getTranslations("patient"),
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/70 backdrop-blur-[14px]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-base font-extrabold text-primary-700 sm:text-lg">
          <Stethoscope aria-hidden className="size-6" />
          <span>
            Care<span className="text-text">Connect</span>
          </span>
        </Link>
        <Link
          href="/directory"
          className="tap-target hidden items-center rounded-md px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-muted hover:text-text sm:flex"
        >
          {tPatient("findDoctor")}
        </Link>
        <div className="hidden text-sm text-text-muted md:block">{t("kicker")}</div>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher label={t("language")} />
          <Link
            href={user ? "/post-login" : "/login"}
            className={
              user
                ? "tap-target flex items-center rounded-md px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-muted hover:text-text"
                : "tap-target flex items-center rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
            }
          >
            {user ? t("myAccount") : t("login")}
          </Link>
          {user && <LogoutButton />}
        </div>
      </div>
    </header>
  );
}
