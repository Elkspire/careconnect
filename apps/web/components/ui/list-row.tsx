import type { ReactNode } from "react";

/**
 * Replaces .qrow/.prow/.vslip/.trow — the app's dominant "row" pattern
 * (queues, permissions, records, share links). Full-width, generous
 * vertical padding so the row itself meets the 44px tap-target height
 * even when it holds a small control (toggle, checkbox) — see the
 * tap-target migration note in the revamp plan.
 */
export function ListRow({
  title,
  subtitle,
  meta,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-text">{title}</div>
        {subtitle && <div className="truncate text-sm text-text-muted">{subtitle}</div>}
      </div>
      {(meta || action) && (
        <div className="ms-auto flex shrink-0 items-center gap-3">
          {meta && <span className="text-sm text-text-muted">{meta}</span>}
          {action}
        </div>
      )}
    </div>
  );
}
