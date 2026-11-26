"use client";

import { useId, useState } from "react";
import type { AppLocale } from "@/i18n/routing";
import { LanguageMenu } from "@/components/language-menu";

/**
 * Settings' language field: the same dropdown as the header, as a
 * full-width form field. It posts its value through a hidden input, so the
 * surrounding server-action form reads it exactly like the native <select>
 * it replaces.
 *
 * Labelled with its own <span> rather than wrapped in FormField's <label>:
 * a <label> around a whole menu would forward clicks on the option buttons
 * back to the trigger.
 */
export function LanguageSelectField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: AppLocale;
}) {
  const [value, setValue] = useState<AppLocale>(defaultValue);
  const labelId = useId();

  return (
    <div>
      <span
        id={labelId}
        className="mb-1.5 block text-xs font-semibold text-text-label"
      >
        {label}
      </span>
      <LanguageMenu
        variant="field"
        label={label}
        labelledBy={labelId}
        value={value}
        onSelect={setValue}
      />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
