import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Inter, Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from "next/font/google";
import { routing, type AppLocale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/toast-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import "../globals.css";

// The prototypes' type: Inter for UI text, Plus Jakarta Sans for headings,
// Noto Nastaliq for Urdu (see tailwind-preset.css's @theme block).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
const nastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq",
  subsets: ["arabic"],
  weight: ["400", "600"],
  // Only Urdu pages use it; don't make every page download it.
  preload: false,
  // Comes after Inter / Plus Jakarta Sans in --font-urdu (see the preset), so
  // its generated serif fallback would never be reached anyway.
  adjustFontFallback: false,
  fallback: [],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout(props: LayoutProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const dir = (locale as AppLocale) === "ur" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${jakarta.variable} ${nastaliq.variable} antialiased`}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <NavigationProgress />
          <SiteHeader />
          {props.children}
          <ToastProvider />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
