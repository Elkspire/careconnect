"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Languages, LoaderCircle } from "lucide-react";
import { LOCALE_LABELS, routing, type AppLocale } from "@/i18n/routing";

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

/**
 * The one language dropdown, shared by the header switcher and the
 * Settings form so both look and behave the same: a styled menu rather
 * than a native <select> (which can't be themed consistently across
 * browsers), with each language in its own script plus its English name,
 * a check on the current one, full keyboard support (arrows, Home/End,
 * Enter, Esc, Tab) and click-outside to close.
 *
 *   variant="compact" — header button: icon + name (short name on phones)
 *   variant="field"   — full-width form field matching the site's inputs
 */
export function LanguageMenu({
  value,
  onSelect,
  label,
  variant,
  busy = false,
  labelledBy,
}: {
  value: AppLocale;
  onSelect: (locale: AppLocale) => void;
  /** Accessible name of the menu ("Language"). */
  label: string;
  variant: "compact" | "field";
  /** Show a spinner and disable the trigger (e.g. while switching). */
  busy?: boolean;
  /** id of a visible label element, for the field variant. */
  labelledBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => routing.locales.indexOf(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  function openMenu(focusIndex = routing.locales.indexOf(value)) {
    setActiveIndex(focusIndex);
    setOpen(true);
  }

  function closeMenu({ refocus = true } = {}) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function choose(next: AppLocale) {
    closeMenu();
    if (next !== value) onSelect(next);
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

  const icon = busy ? (
    <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />
  ) : (
    <Languages aria-hidden className="size-4 shrink-0" />
  );
  const chevron = (
    <ChevronDown
      aria-hidden
      className={`size-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    />
  );

  return (
    <div ref={rootRef} className={variant === "field" ? "relative w-full" : "relative"}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={labelledBy ? undefined : `${label}: ${LOCALE_LABELS[value]}`}
        aria-labelledby={labelledBy ? `${labelledBy} ${menuId}-value` : undefined}
        disabled={busy}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onButtonKeyDown}
        className={
          variant === "field"
            ? `tap-target flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-start text-sm text-text transition focus:outline-2 focus:outline-offset-1 focus:outline-primary-600 disabled:cursor-wait ${
                open ? "border-primary-600 outline-2 outline-offset-1 outline-primary-600" : "border-border-strong hover:border-primary-600"
              }`
            : `tap-target flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-wait ${
                open
                  ? "border-primary-500 bg-primary-50 text-primary-800"
                  : "border-border text-text-muted hover:border-primary-500 hover:text-text"
              }`
        }
      >
        {variant === "field" ? (
          <>
            <span className="text-text-muted">{icon}</span>
            <span id={`${menuId}-value`} className="min-w-0 flex-1 truncate">
              <bdi lang={value} className="font-medium">
                {LOCALE_LABELS[value]}
              </bdi>
              {value !== "en" && (
                <span className="ms-2 text-xs text-text-muted">
                  <bdi lang="en">{ENGLISH_NAMES[value]}</bdi>
                </span>
              )}
            </span>
            <span className="text-text-muted">{chevron}</span>
          </>
        ) : (
          <>
            {icon}
            <span lang={value} className="hidden sm:inline">
              {LOCALE_LABELS[value]}
            </span>
            <span lang={value} className="sm:hidden">
              {SHORT_LABELS[value]}
            </span>
            {chevron}
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full z-50 mt-2 animate-[menu-in_120ms_ease-out] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg motion-reduce:animate-none ${
            variant === "field"
              ? "inset-x-0 origin-top"
              : "end-0 w-56 origin-top-right rtl:origin-top-left"
          }`}
        >
          {routing.locales.map((l, i) => {
            const selected = l === value;
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
