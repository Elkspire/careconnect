import { defineRouting } from "next-intl/routing";

/**
 * en/ur only for v1. ur is RTL — see app/[locale]/layout.tsx for the dir
 * attribute this drives, and packages/config/tailwind-preset.css for the
 * logical-property convention that makes components flip automatically.
 */
export const routing = defineRouting({
  locales: ["en", "ur"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];
