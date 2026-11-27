import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { KpiCard, KpiGrid } from "./kpi-card";

/** Kept for existing pages: a KpiCard with just a label and value. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <KpiGrid>{children}</KpiGrid>;
}

export function StatTile({
  value,
  label,
  icon,
}: {
  value: string | number;
  label: string;
  icon?: LucideIcon;
}) {
  return <KpiCard value={value} label={label} icon={icon} />;
}
