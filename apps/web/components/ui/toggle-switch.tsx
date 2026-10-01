"use client";

/**
 * Replaces the inline .tg pattern from push-notifications.tsx /
 * staff-invite-fields.tsx, in one place. Deliberately NOT given the
 * tap-target class directly — its correct visual size (44x24px) is
 * smaller than the 44x44 tap-target minimum, and forcing that minimum
 * here is exactly what caused the squashed-toggle bug fixed earlier.
 * Callers are responsible for giving the surrounding row enough height
 * (e.g. ListRow's py-3) for the actual tap area.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
        checked ? "bg-primary-600" : "bg-border-strong"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5 rtl:-translate-x-5" : ""
        }`}
      />
    </button>
  );
}
