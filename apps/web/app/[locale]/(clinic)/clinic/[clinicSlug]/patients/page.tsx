import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listClinicPatients } from "@/lib/api/clinic";
import { resolveClinicStaffBySlug } from "@/lib/api/me";
import { formatClinicDate } from "@/lib/format-time";

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
    <div className="max-w-6xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("patientsHeading")}</h1>
      {patients.length === 0 ? (
        <p className="mt-6" style={{ color: "var(--color-ink-soft)" }}>
          {t("noAppointmentsToday")}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {patients.map((p) => (
            <li key={p.patientId} className="card">
              <b className="disp font-semibold">{p.fullName}</b>
              <p className="mt-1 text-sm" style={{ color: "#6b7b73" }}>
                {p.phone}
              </p>
              <p className="mono mt-1 text-xs" style={{ color: "#7a8a82" }}>
                {t("lastVisitLabel")}: {formatClinicDate(p.lastVisit, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
