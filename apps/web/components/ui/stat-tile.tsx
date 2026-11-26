import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Replaces .stats/.stat and .hero-stats/.hero-stat — an auto-fit grid of stat tiles. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">{children}</div>
  );
}

export function StatTile({
  value,
  label,
  icon: Icon,
}: {
  value: string | number;
  label: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      {Icon && (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
          <Icon aria-hidden className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-xs font-semibold text-text-muted">{label}</div>
        <div className="mt-0.5 font-display text-[26px] font-extrabold leading-tight text-text">
          {value}
        </div>
      </div>
    </div>
  );
}
