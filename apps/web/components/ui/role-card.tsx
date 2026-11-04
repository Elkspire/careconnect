import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** Promotes the RoleCard previously duplicated inline in onboarding/page.tsx. */
export function RoleCard({
  href,
  icon: Icon,
  title,
  description,
  selected = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-pressed={selected}
      className={`tap-target rounded-lg border-2 p-5 text-center transition ${
        selected
          ? "border-primary-600 bg-primary-50"
          : "border-border bg-surface hover:border-primary-500 hover:bg-primary-50"
      }`}
    >
      <Icon aria-hidden className="mx-auto size-8 text-primary-600" />
      <div className="mt-2 font-semibold text-text">{title}</div>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
    </Link>
  );
}
