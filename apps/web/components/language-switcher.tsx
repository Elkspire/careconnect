"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Languages, LoaderCircle } from "lucide-react";
import { useLocale } from "next-intl";
import { LOCALE_COOKIE, LOCALE_LABELS, routing, type AppLocale } from "@/i18n/routing";

/** Shown under each language's own name, so everyone can find theirs. */
const ENGLISH_NAMES: Record<AppLocale, string> = {
  en: "English",
  ur: "Urdu",
  "ur-Latn": "Urdu in English letters",
};

/** Compact trigger label for narrow screens. */
const SHORT_LABELS: Record<AppLocale, string> = {
  en: "EN",
  ur: "اردو",
  "ur-Latn": "Roman",
};

/** Saves the language where next-intl reads it, then reloads into it. */
function switchLocale(next: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  window.location.reload();
}

/**
 * Header language picker: a styled menu rather than a native <select>
 * (which can't be themed consistently across browsers).
 *
 * Choosing a language writes next-intl's NEXT_LOCALE cookie and reloads
 * the page. URLs carry no language segment (see routing.ts), and a full
 * reload — rather than a soft navigation — is what reliably swaps <html
 * lang/dir>: switching out of RTL Urdu via soft navigation left the old
 * dir in place, which is what scrambled this control's own layout.
 *
 * This only changes what the site is shown in; a patient's saved
 * notification language lives in their profile settings.
 */
export function LanguageSwitcher({ label }: { label: string }) {
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => routing.locales.indexOf(locale));
  const [switchingTo, setSwitchingTo] = useState<AppLocale | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  function openMenu(focusIndex = routing.locales.indexOf(locale)) {
    setActiveIndex(focusIndex);
    setOpen(true);
  }

  function closeMenu({ refocus = true } = {}) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function choose(next: AppLocale) {
    if (next === locale) {
      closeMenu();
      return;
    }
    setSwitchingTo(next);
    setOpen(false);
    switchLocale(next);
  }

  // Move focus onto the highlighted option whenever the menu opens or the
  // highlight moves, so arrow keys and screen readers follow along.
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  // Close on any click outside the control.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(e.key === "ArrowUp" ? routing.locales.length - 1 : 0);
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const last = routing.locales.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i === last ? 0 : i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i === 0 ? last : i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(last);
        break;
      case "Escape":
        e.preventDefault();
        closeMenu();
        break;
      case "Tab":
        closeMenu({ refocus: false });
        break;
    }
  }

  const busy = switchingTo !== null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label}: ${LOCALE_LABELS[locale]}`}
        disabled={busy}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onButtonKeyDown}
        className={`tap-target flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 disabled:cursor-wait ${
          open
            ? "border-primary-500 bg-primary-50 text-primary-800"
            : "border-border text-text-muted hover:border-primary-500 hover:text-text"
        }`}
      >
        {busy ? (
          <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />
        ) : (
          <Languages aria-hidden className="size-4 shrink-0" />
        )}
        <span lang={locale} className="hidden sm:inline">
          {LOCALE_LABELS[locale]}
        </span>
        <span lang={locale} className="sm:hidden">
          {SHORT_LABELS[locale]}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute end-0 top-full z-50 mt-2 w-56 origin-top-right animate-[menu-in_120ms_ease-out] rtl:origin-top-left motion-reduce:animate-none overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {routing.locales.map((l, i) => {
            const selected = l === locale;
            return (
              <button
                key={l}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={i === activeIndex ? 0 : -1}
                onClick={() => choose(l)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-start transition focus:outline-none ${
                  i === activeIndex ? "bg-surface-muted" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-semibold ${selected ? "text-primary-700" : "text-text"}`}
                  >
                    {/* bdi: reads Urdu right-to-left, but stays aligned with the others. */}
                    <bdi lang={l}>{LOCALE_LABELS[l]}</bdi>
                  </span>
                  <span className="block text-xs text-text-muted">
                    <bdi lang="en">{ENGLISH_NAMES[l]}</bdi>
                  </span>
                </span>
                <Check
                  aria-hidden
                  className={`size-4 shrink-0 text-primary-600 ${selected ? "" : "invisible"}`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
