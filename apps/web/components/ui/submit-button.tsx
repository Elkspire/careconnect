"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

/**
 * Drop-in replacement for `<button type="submit">` inside a server-action
 * form. While the action runs it disables the button (no double submits)
 * and shows a spinner — but only on the button that was actually pressed:
 * a form with many submit buttons (e.g. one per time slot) or a
 * `formAction` override (e.g. "Join waitlist") spins just that one.
 *
 * Has no effect inside plain GET forms; those are page navigations, which
 * NavigationProgress covers instead.
 */
export function SubmitButton({
  children,
  className = "",
  disabled,
  formAction,
  name,
  value,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending, data, action } = useFormStatus();

  const isThisButton =
    pending &&
    (formAction === undefined || action === formAction) &&
    (name === undefined || data?.get(name) === String(value ?? ""));

  return (
    <button
      type="submit"
      formAction={formAction}
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={isThisButton || undefined}
      className={`${className} disabled:cursor-wait ${pending && !isThisButton ? "opacity-60" : ""}`}
      {...rest}
    >
      {isThisButton ? (
        <span className="inline-flex items-center justify-center gap-2">
          <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
