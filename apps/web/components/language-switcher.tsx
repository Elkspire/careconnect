"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { LOCALE_COOKIE, type AppLocale } from "@/i18n/routing";
import { saveLocaleAction } from "@/lib/locale-actions";
import { LanguageMenu } from "@/components/language-menu";

/**
 * Saves the language (cookie, plus a signed-in patient's profile so
 * Settings matches — see saveLocaleAction), then reloads into it. The
 * cookie is also written here so the switch still happens if the server
 * call fails.
 */
async function switchLocale(next: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    await saveLocaleAction(next);
  } finally {
    window.location.reload();
  }
}

/**
 * Header language picker. URLs carry no language segment (see
 * routing.ts), and a full reload — rather than a soft navigation — is what
 * reliably swaps <html lang/dir>: switching out of RTL Urdu via soft
 * navigation left the old dir in place, which scrambled the layout.
 */
export function LanguageSwitcher({ label }: { label: string }) {
  const locale = useLocale() as AppLocale;
  const [switching, setSwitching] = useState(false);

  return (
    <LanguageMenu
      variant="compact"
      label={label}
      value={locale}
      busy={switching}
      onSelect={(next) => {
        setSwitching(true);
        void switchLocale(next);
      }}
    />
  );
}
