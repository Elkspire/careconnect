import { Link } from "@/i18n/navigation";

export interface TabItem {
  key: string;
  label: string;
  /** Shown in a chip after the label, e.g. how many rows this tab holds. */
  count?: number;
  href: string;
}

/**
 * The prototypes' underlined tab bar, for switching a list between views
 * ("All 248 · High priority 12 · Inactive 31"). Each tab is a link, so the
 * view lives in the URL (?tab=...): it works in server components, survives
 * a reload and can be shared. That makes it navigation, not an ARIA tab
 * widget, so the current one is marked aria-current rather than
 * aria-selected.
 */
export function Tabs({
  items,
  active,
  label,
}: {
  items: TabItem[];
  /** The key of the current tab. */
  active: string;
  /** What the tabs choose between, for screen readers (e.g. "Patients"). */
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-4 overflow-x-auto border-b border-border">
      <ul className="flex gap-6">
        {items.map((item) => {
          const current = item.key === active;
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`tap-target -mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 text-sm font-semibold whitespace-nowrap no-underline transition-colors ${
                  current
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-px text-xs font-semibold tabular-nums ${
                      current ? "bg-primary-50 text-primary-900" : "bg-neutral-bg text-neutral-fg"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
