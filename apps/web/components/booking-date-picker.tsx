"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { FormField } from "@/components/ui/form-field";

/**
 * The booking page's date field. Picking a date reloads the slot list
 * straight away (a soft navigation to ?date=…) instead of making the
 * patient press a separate "Pick a date" button. The page itself still
 * reads the date from the URL server-side, so a refresh or shared link
 * shows the same day.
 */
export function BookingDatePicker({
  label,
  loadingLabel,
  date,
  minDate,
  className,
}: {
  label: string;
  loadingLabel: string;
  date: string;
  minDate: string;
  className: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    // A date input reports "" while a date is only partly typed.
    if (!value || value === date) return;
    startTransition(() => {
      router.replace(`${pathname}?date=${value}`, { scroll: false });
    });
  }

  return (
    <FormField label={label}>
      <span className="flex items-center gap-3">
        <input
          type="date"
          name="date"
          defaultValue={date}
          min={minDate}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
        {pending && (
          <span role="status" className="whitespace-nowrap text-sm text-text-muted">
            {loadingLabel}
          </span>
        )}
      </span>
    </FormField>
  );
}
