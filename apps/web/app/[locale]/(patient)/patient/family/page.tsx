import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listFamilyMembers } from "@/lib/api/patients";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { addFamilyMemberAction } from "../../actions";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function FamilyMembersPage(
  props: PageProps<"/[locale]/patient/family">,
) {
  const { locale } = await props.params;
  const [t, familyMembers] = await Promise.all([getTranslations("patient"), listFamilyMembers()]);
  const action = addFamilyMemberAction.bind(null, locale);

  return (
    <div>
      <PageHeader icon={Users} kicker="CareConnect" title={t("familyMembersHeading")} />

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

      <Card padding="lg" className="max-w-xl">
        <form action={action} className="flex flex-wrap items-end gap-3">
          <FormField label={t("fullNameLabel")}>
            <input
              type="text"
              name="fullName"
              required
              className="tap-target rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </FormField>
          <FormField label={t("relationshipLabel")}>
            <select
              name="relationship"
              className="tap-target rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
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
          <SubmitButton
            className="tap-target rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
          >
            {t("addFamilyMember")}
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
