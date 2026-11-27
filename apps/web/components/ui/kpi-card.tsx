import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

/** The prototypes' KPI icon squares: tinted background, darker icon. */
const TONE = {
  teal: "bg-primary-50 text-primary-900",
  amber: "bg-warning-bg text-warning-fg",
  blue: "bg-info-bg text-info-fg",
  purple: "bg-purple-bg text-purple-fg",
  red: "bg-danger-bg text-danger-fg",
} as const;

export type KpiTone = keyof typeof TONE;

export interface KpiTrend {
  direction: "up" | "down";
  /** e.g. "+36 this month". */
  label: string;
  /** Whether this change is good news. Up isn't always good: no-shows. */
  good: boolean;
}

/** An auto-fit grid of KPI cards, four across on a wide screen. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13.75rem),1fr))] gap-4">
      {children}
    </div>
  );
}

/**
 * The dashboard's headline number: icon square, label, big value, and an
 * optional line under it (a breakdown, or a trend with an arrow).
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "teal",
  hint,
  trend,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  hint?: ReactNode;
  trend?: KpiTrend;
}) {
  const TrendIcon = trend?.direction === "down" ? TrendingDown : TrendingUp;
  return (
    <div className="flex items-start gap-3.5 rounded-lg border border-border bg-surface p-[18px] shadow-sm">
      {Icon && (
        <span
          className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md ${TONE[tone]}`}
        >
          <Icon aria-hidden className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-text-muted">{label}</p>
        <p className="font-display text-[26px] font-bold leading-tight text-text">{value}</p>
        {trend && (
          <p
            className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${
              trend.good ? "text-success-fg" : "text-danger-fg"
            }`}
          >
            <TrendIcon aria-hidden className="size-3.5 shrink-0 rtl:-scale-x-100" />
            {trend.label}
          </p>
        )}
        {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
      </div>
    </div>
  );
}
