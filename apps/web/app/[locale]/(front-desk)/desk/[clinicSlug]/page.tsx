import ClinicTodayPage from "../../../(clinic)/clinic/[clinicSlug]/today/page";

/**
 * The front desk's queue: the same list, check-in and waitlist as the
 * clinic's Today page (it takes the same params), in the desk's frame.
 */
export default function FrontDeskQueuePage(props: PageProps<"/[locale]/desk/[clinicSlug]">) {
  return (
    <ClinicTodayPage {...(props as unknown as PageProps<"/[locale]/clinic/[clinicSlug]/today">)} />
  );
}
