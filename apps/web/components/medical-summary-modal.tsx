import { useTranslations } from "next-intl";
import type { FormResult } from "@/lib/form-result";
import { FormField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/overlay";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const inputClasses =
  "tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600";

interface Summary {
  bloodGroup: string | null;
  allergies: string[];
  chronicConditions: string[];
  activeMedications: string[];
}

/**
 * "Edit medical summary" for a patient or family member: a link that opens
 * the form in a modal. Shared by the clinic's patient pages and the
 * patient's own records page, which all post the same fields.
 */
export function MedicalSummaryModal({
  summary,
  action,
  familyMemberId,
  subjectName,
}: {
  summary: Summary | null;
  action: (formData: FormData) => Promise<FormResult>;
  familyMemberId?: string;
  /** Whose summary, shown under the title. */
  subjectName?: string;
}) {
  const t = useTranslations("vault");
  return (
    <div className="mt-4">
      <Modal
        trigger={t("editMedicalSummary")}
        triggerVariant="link"
        title={t("editMedicalSummary")}
        description={subjectName}
        formAction={action}
        submitLabel={t("saveMedicalSummary")}
      >
        {familyMemberId && <input type="hidden" name="familyMemberId" value={familyMemberId} />}
        <div className="flex flex-col gap-4">
          <FormField label={t("bloodGroupLabel")}>
            <select name="bloodGroup" defaultValue={summary?.bloodGroup ?? ""} className={inputClasses}>
              <option value="">{t("unknown")}</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </FormField>
          {(["allergies", "chronicConditions", "activeMedications"] as const).map((field) => (
            <FormField key={field} label={t(`${field}Label`)} hint={t("oneItemPerLine")}>
              <textarea
                name={field}
                rows={3}
                defaultValue={summary?.[field].join("\n")}
                className={inputClasses}
              />
            </FormField>
          ))}
        </div>
      </Modal>
    </div>
  );
}
