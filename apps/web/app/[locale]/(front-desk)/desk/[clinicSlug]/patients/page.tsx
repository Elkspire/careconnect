import ClinicPatientsPage from "../../../../(clinic)/clinic/[clinicSlug]/patients/page";

/** The front desk's patient list: the clinic's, in the desk's frame. */
export default function FrontDeskPatientsPage(
  props: PageProps<"/[locale]/desk/[clinicSlug]/patients">,
) {
  return (
    <ClinicPatientsPage {...(props as unknown as PageProps<"/[locale]/clinic/[clinicSlug]/patients">)} />
  );
}
