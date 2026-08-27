import { getTranslations } from "next-intl/server";
import { listFamilyMembers } from "@/lib/api/patients";
import { addFamilyMemberAction } from "../../actions";

export default async function FamilyMembersPage(
  props: PageProps<"/[locale]/patient/family">,
) {
  const { locale } = await props.params;
  const [t, familyMembers] = await Promise.all([getTranslations("patient"), listFamilyMembers()]);
  const action = addFamilyMemberAction.bind(null, locale);

  return (
    <div className="max-w-5xl">
      <p className="kicker" style={{ color: "var(--color-verified)" }}>
        CareConnect
      </p>
      <h1 className="disp mt-2 text-2xl font-bold">{t("familyMembersHeading")}</h1>

      {familyMembers.length === 0 ? (
        <p className="mt-6" style={{ color: "var(--color-ink-soft)" }}>
          {t("noFamilyMembers")}
        </p>
      ) : (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {familyMembers.map((member) => (
            <li key={member.id} className="card flex items-center justify-between">
              <span className="disp font-semibold">{member.fullName}</span>
              <span className="vtag">
                {t(`relationship.${member.relationship}` as "relationship.husband")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="slip mt-8 flex max-w-xl flex-wrap items-end gap-3">
        <label>
          <span className="lbl">{t("fullNameLabel")}</span>
          <input type="text" name="fullName" required className="field tap-target" />
        </label>
        <label>
          <span className="lbl">{t("relationshipLabel")}</span>
          <select name="relationship" className="field tap-target">
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
        </label>
        <button type="submit" className="btn tap-target">
          {t("addFamilyMember")}
        </button>
      </form>
    </div>
  );
}
