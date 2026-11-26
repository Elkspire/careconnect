import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listFamilyMembers } from "@/lib/api/patients";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { addFamilyMemberAction } from "../../actions";
import { Modal } from "@/components/ui/overlay";

export default async function FamilyMembersPage(
  props: PageProps<"/[locale]/patient/family">,
) {
  const { locale } = await props.params;
  const [t, familyMembers] = await Promise.all([getTranslations("patient"), listFamilyMembers()]);
  const action = addFamilyMemberAction.bind(null, locale);

  return (
    <div>
      <PageHeader
        icon={Users}
        kicker="CareConnect"
        title={t("familyMembersHeading")}
        actions={
          <Modal
            trigger={t("addFamilyMember")}
            triggerVariant="primary"
            title={t("addFamilyMember")}
            formAction={action}
            submitLabel={t("addFamilyMember")}
          >
            <div className="flex flex-col gap-4">
              <FormField label={t("fullNameLabel")}>
                <input type="text" name="fullName" required className="tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600" />
              </FormField>
              <FormField label={t("relationshipLabel")}>
                <select name="relationship" className="tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600">
                  <optgroup label={t("relationshipGroups.spouse")}>
                    <option value="husband">{t("relationship.husband")}</option>
                    <option value="wife">{t("relationship.wife")}</option>
                  </optgroup>
                  <optgroup label={t("relationshipGroups.child")}>
                    <option value="son">{t("relationship.son")}</option>
                    <option value="daughter">{t("relationship.daughter")}</option>
                  </optgroup>
                  <optgroup label={t("relationshipGroups.parent")}>
                    <option value="mother">{t("relationship.mother")}</option>
                    <option value="father">{t("relationship.father")}</option>
                  </optgroup>
                </select>
              </FormField>
            </div>
          </Modal>
        }
      />

      {familyMembers.length === 0 ? (
        <EmptyState icon={Users} title={t("noFamilyMembers")} />
      ) : (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {familyMembers.map((member) => (
            <li key={member.id}>
              <Card className="flex items-center justify-between gap-2">
                <span className="font-semibold text-text">{member.fullName}</span>
                <Badge tone="blue">
                  {t(`relationship.${member.relationship}` as "relationship.husband")}
                </Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
