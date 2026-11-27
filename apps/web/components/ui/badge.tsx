import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The prototypes' chip colours (.lo .info .md .hi .pu .neu .tl). */
const TONE = {
  green: { chip: "bg-success-bg text-success-fg", dot: "bg-success-fg" },
  blue: { chip: "bg-info-bg text-info-fg", dot: "bg-info-fg" },
  orange: { chip: "bg-warning-bg text-warning-fg", dot: "bg-warning-fg" },
  red: { chip: "bg-danger-bg text-danger-fg", dot: "bg-danger-fg" },
  purple: { chip: "bg-purple-bg text-purple-fg", dot: "bg-purple-fg" },
  gray: { chip: "bg-neutral-bg text-neutral-fg", dot: "bg-neutral-fg" },
  teal: { chip: "bg-primary-50 text-primary-900", dot: "bg-primary-600" },
} as const;

export type BadgeTone = keyof typeof TONE;

/** A small status/label pill. `dot` adds the prototypes' leading status dot. */
export function Badge({
  tone = "gray",
  icon: Icon,
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  icon?: LucideIcon;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs leading-normal font-semibold ${TONE[tone].chip}`}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {dot && !Icon && <span aria-hidden className={`size-1.5 rounded-full ${TONE[tone].dot}`} />}
      {children}
    </span>
  );
}
