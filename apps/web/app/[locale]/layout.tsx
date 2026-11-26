import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import localFont from "next/font/local";
import { routing, type AppLocale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/toast-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import "../globals.css";

// The prototypes' type: Inter for UI text, Plus Jakarta Sans for headings,
// Noto Nastaliq for Urdu (see tailwind-preset.css's @theme block).
//
// Bundled from @fontsource-variable/* rather than next/font/google: that
// downloads every font file from Google during the build, and one slow or
// failed download fails the whole build ("Can't resolve
// '@vercel/turbopack-next/internal/font/google/font'"). Variable fonts, so
// one file covers every weight. Latin only for Inter and Jakarta, Urdu
// script only for Nastaliq: on Urdu pages each character falls through to
// the font that has it (see --font-urdu in the preset). next/font needs
// every path written out in full.
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
});
const jakarta = localFont({
  src: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-jakarta",
});
const nastaliq = localFont({
  src: "../../node_modules/@fontsource-variable/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-wght-normal.woff2",
  weight: "400 700",
  variable: "--font-nastaliq",
  // Only Urdu pages use it; don't make every page download it.
  preload: false,
  // Comes after Inter / Plus Jakarta Sans in --font-urdu, so its generated
  // fallback would never be reached anyway.
  adjustFontFallback: false,
});

/**
 * Each font's own family name, without the size-adjusted system-font
 * fallback next/font lists after it. That fallback covers every script, so
 * on Urdu pages it would catch Urdu letters before Nastaliq could.
 */
const primaryFamilies = {
  "--font-inter-only": inter.style.fontFamily.split(",")[0],
  "--font-jakarta-only": jakarta.style.fontFamily.split(",")[0],
} as CSSProperties;

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
    <html lang={locale} dir={dir} className={`${inter.variable} ${jakarta.variable} ${nastaliq.variable} antialiased`}
      style={primaryFamilies}>
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
