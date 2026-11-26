import { Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listClinicPatients } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate } from "@/lib/format-time";
import { PageHeader } from "@/components/ui/page-header";
import { InitialsAvatar } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
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
        <DataTable
          caption={t("patientsHeading")}
          initialSort={{ key: "lastVisit", direction: "descending" }}
          columns={[
            { key: "name", header: t("patientLabel"), sortable: true },
            { key: "phone", header: t("phoneLabel") },
            { key: "lastVisit", header: t("lastVisitLabel"), sortable: true },
          ]}
          rows={patients.map((p) => ({
            key: `${p.patientId}-${p.familyMemberId ?? "self"}`,
            sortValues: { name: p.fullName, lastVisit: new Date(p.lastVisit) },
            cells: {
              name: (
                <Link
                  href={
                    p.familyMemberId
                      ? `/clinic/${clinicSlug}/patients/${p.patientId}/family/${p.familyMemberId}`
                      : `/clinic/${clinicSlug}/patients/${p.patientId}`
                  }
                  className="flex items-center gap-3 text-text no-underline hover:text-primary-700"
                >
                  <InitialsAvatar name={p.fullName} size="sm" />
                  <span className="min-w-0">
                    <b className="block font-semibold">{p.fullName}</b>
                    {p.guardianFullName && (
                      <span className="block text-xs font-medium text-primary-700">
                        {t("familyMemberOfLabel", { name: p.guardianFullName })}
                      </span>
                    )}
                  </span>
                </Link>
              ),
              phone: <span className="text-text-muted">{p.phone ?? "—"}</span>,
              lastVisit: formatClinicDate(p.lastVisit, locale),
            },
          }))}
        />
      )}
    </div>
  );
}
