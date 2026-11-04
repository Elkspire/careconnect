import { Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface ClinicOption {
  clinicSlug: string;
  clinicName: string;
  roleLabel: string;
}

/**
 * Lists every clinic the current user is active staff at. Without it, a
 * practitioner who owns one clinic and was invited as a junior doctor at
 * another had no route to the second — post-login always lands on the
 * first active clinic, and nothing linked anywhere else. Rendered only when
 * there's actually more than one clinic to choose between.
 */
export function ClinicSwitcher({
  heading,
  clinics,
  currentSlug,
}: {
  heading: string;
  clinics: ClinicOption[];
  currentSlug: string;
}) {
  if (clinics.length < 2) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {heading}
      </p>
      <ul className="flex flex-col gap-1">
        {clinics.map((c) => {
          const active = c.clinicSlug === currentSlug;
          return (
            <li key={c.clinicSlug}>
              <Link
                href={`/clinic/${c.clinicSlug}/today`}
                aria-current={active ? "page" : undefined}
                className={`flex items-start gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary-50 text-primary-800"
                    : "text-text-muted hover:bg-surface-muted hover:text-text"
                }`}
              >
                <Building2 aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.clinicName}</span>
                  <span className="block text-xs opacity-80">{c.roleLabel}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
