"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  STAFF_PERMISSION_KEYS,
  isPermissionGranted,
  type AssignableStaffRole,
} from "@/lib/staff-permissions";

const ROLES: AssignableStaffRole[] = ["receptionist", "junior_doctor", "assistant"];

/** Lets a doctor pick a role and see exactly what it can and can't reach,
 * before assigning it in the invite form below. */
export function StaffPermissionMatrix() {
  const t = useTranslations("clinic");
  const [role, setRole] = useState<AssignableStaffRole>("receptionist");

  return (
    <div>
      <p className="lbl">{t("permissionsHeading")}</p>
      <div className="pmx">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            className={`tap-target${r === role ? " on" : ""}`}
            aria-pressed={r === role}
            onClick={() => setRole(r)}
          >
            {t(`roles.${r}`)}
          </button>
        ))}
      </div>
      <div className="pgrid">
        {STAFF_PERMISSION_KEYS.map((key) => {
          const allowed = isPermissionGranted(role, key);
          return (
            <div key={key} className={`prow ${allowed ? "yes" : "no"}`}>
              <span>{t(`permissions.${key}`)}</span>
              <em>{allowed ? t("permissionAllowed") : t("permissionBlocked")}</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}
