import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import type { AppLocale } from "@/i18n/routing";

export async function SiteHeader({ locale }: { locale: AppLocale }) {
  const [t, supabase] = await Promise.all([getTranslations("site"), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="mast">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" locale={locale} className="flex items-center gap-3">
          <span className="wordmark">
            Care<span>Connect</span>
          </span>
        </Link>
        <div className="hidden sm:block kicker">{t("kicker")}</div>
        <div className="flex items-center gap-1">
          <Link
            href={user ? "/post-login" : "/login"}
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {user ? t("myAccount") : t("login")}
          </Link>
          {user && <LogoutButton />}
        </div>
      </div>
    </header>
  );
}
