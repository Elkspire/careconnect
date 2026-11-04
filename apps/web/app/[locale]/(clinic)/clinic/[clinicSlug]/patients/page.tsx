import { Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listClinicPatients } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { InitialsAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ClinicPatientsPage(
  props: PageProps<"/[locale]/clinic/[clinicSlug]/patients">,
) {
  const { locale, clinicSlug } = await props.params;
  const [t, staffCtx] = await Promise.all([
    getTranslations("clinic"),
    resolveClinicStaffBySlug(clinicSlug),
  ]);
  if (!staffCtx) {
    notFound();
  }

  const patients = await listClinicPatients(staffCtx.clinicId);

  return (
    <div>
      <PageHeader icon={Users} kicker="CareConnect" title={t("patientsHeading")} />
      {patients.length === 0 ? (
        <EmptyState icon={Users} title={t("noAppointmentsToday")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {patients.map((p) => (
            <li key={`${p.patientId}-${p.familyMemberId ?? "self"}`}>
              <Link
                href={
                  p.familyMemberId
                    ? `/clinic/${clinicSlug}/patients/${p.patientId}/family/${p.familyMemberId}`
                    : `/clinic/${clinicSlug}/patients/${p.patientId}`
                }
                className="block h-full"
              >
                <Card interactive className="flex h-full items-start gap-3">
                  <InitialsAvatar name={p.fullName} size="md" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate font-semibold text-text">{p.fullName}</b>
                    {p.guardianFullName && (
                      <p className="truncate text-xs font-medium text-primary-700">
                        {t("familyMemberOfLabel", { name: p.guardianFullName })}
                      </p>
                    )}
                    <p className="truncate text-sm text-text-muted">{p.phone}</p>
                    <p className="mt-1 text-xs text-text-faint">
                      {t("lastVisitLabel")}: {formatClinicDate(p.lastVisit, locale)}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
