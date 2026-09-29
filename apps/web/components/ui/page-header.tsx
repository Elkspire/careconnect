import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Replaces the repeated kicker+h1 boilerplate at the top of every dashboard page. */
export function PageHeader({
  icon: Icon,
  kicker,
  title,
  description,
  actions,
}: {
  icon?: LucideIcon;
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {kicker && (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            {kicker}
          </p>
        )}
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-text">
          {Icon && <Icon aria-hidden className="size-6 text-primary-600" />}
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
