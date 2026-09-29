import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Replaces .stats/.stat and .hero-stats/.hero-stat — an auto-fit grid of stat tiles. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">{children}</div>
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
    <div className="rounded-md border border-border bg-surface-muted px-4 py-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon aria-hidden className="size-4 text-primary-600" />}
        <span className="text-2xl font-extrabold text-primary-800">{value}</span>
      </div>
      <div className="mt-0.5 text-xs font-medium text-text-muted">{label}</div>
    </div>
  );
}
