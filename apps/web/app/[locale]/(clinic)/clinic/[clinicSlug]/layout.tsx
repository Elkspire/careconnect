import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function ClinicLayout(
  props: LayoutProps<"/[locale]/clinic/[clinicSlug]">,
) {
  const { locale, clinicSlug } = await props.params;
  const t = await getTranslations("clinic");

  return (
    <div className="flex flex-1 flex-col">
      <nav className="border-b border-line bg-bottle-2">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-1 px-4 py-2">
          <Link
            href={`/clinic/${clinicSlug}/today`}
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {t("nav.today")}
          </Link>
          <Link
            href={`/clinic/${clinicSlug}/patients`}
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {t("nav.patients")}
          </Link>
          <Link
            href={`/clinic/${clinicSlug}/staff`}
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {t("nav.staff")}
          </Link>
          <Link
            href={`/clinic/${clinicSlug}/notifications`}
            locale={locale}
            className="navlink tap-target flex items-center"
          >
            {t("nav.notifications")}
          </Link>
        </div>
      </nav>
      {props.children}
    </div>
  );
}
