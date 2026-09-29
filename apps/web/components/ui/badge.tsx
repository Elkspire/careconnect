import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const TONE = {
  green: "bg-success-bg text-success-fg",
  blue: "bg-info-bg text-info-fg",
  orange: "bg-warning-bg text-warning-fg",
  red: "bg-danger-bg text-danger-fg",
  purple: "bg-purple-bg text-purple-fg",
  gray: "bg-neutral-bg text-neutral-fg",
} as const;

/** Replaces .vtag/.qs/.flag/.stamp — a small status/label pill. */
export function Badge({
  tone = "gray",
  icon: Icon,
  children,
}: {
  tone?: keyof typeof TONE;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[tone]}`}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}
