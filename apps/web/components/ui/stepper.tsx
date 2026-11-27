import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Where someone is in a multi-step flow. Two looks from the prototypes:
 *
 *   "labels"  numbered circles with each step's name; done steps get a tick
 *             (the partner portal's order steps)
 *   "bar"     a row of short bars (the front desk's walk-in wizard), for
 *             when there's no room for names; the current step is announced
 *
 * Works in server and client components alike.
 */
export function Stepper({
  steps,
  current,
  variant = "labels",
  label,
}: {
  steps: string[];
  /** Zero-based index of the step in progress. steps.length means all done. */
  current: number;
  variant?: "labels" | "bar";
  /** What the steps are of, for screen readers (e.g. "Booking"). */
  label: string;
}) {
  const t = useTranslations("ui");
  const state = (i: number) => (i < current ? "done" : i === current ? "current" : "upcoming");

  if (variant === "bar") {
    return (
      <div>
        <ol aria-label={label} className="flex gap-1.5">
          {steps.map((step, i) => (
            <li
              key={step}
              aria-current={state(i) === "current" ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full ${i <= current ? "bg-primary-600" : "bg-border"}`}
            >
              <span className="sr-only">
                {step}
                {state(i) === "done" && `, ${t("stepDone")}`}
              </span>
            </li>
          ))}
        </ol>
        {current < steps.length && (
          <p className="mt-2 text-xs font-semibold text-text-muted">
            {t("stepOf", { n: current + 1, total: steps.length })} · {steps[current]}
          </p>
        )}
      </div>
    );
  }

  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {steps.map((step, i) => {
        const s = state(i);
        return (
          <li
            key={step}
            aria-current={s === "current" ? "step" : undefined}
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              s === "done" ? "text-success-fg" : s === "current" ? "text-primary-700" : "text-text-faint"
            }`}
          >
            {i > 0 && <span aria-hidden className="me-0.5 h-0.5 w-3.5 rounded-full bg-border" />}
            <span
              aria-hidden
              className={`inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] ${
                s === "done"
                  ? "bg-success-bg"
                  : s === "current"
                    ? "bg-primary-600 text-white"
                    : "bg-neutral-bg"
              }`}
            >
              {s === "done" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            {step}
            {s === "done" && <span className="sr-only">, {t("stepDone")}</span>}
          </li>
        );
      })}
    </ol>
  );
}
