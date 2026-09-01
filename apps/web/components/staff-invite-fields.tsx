"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ROLE_PERMISSION_CEILING,
  type AssignableStaffRole,
  type StaffPermissionKey,
} from "@careconnect/shared-types";

const ROLES: AssignableStaffRole[] = ["receptionist", "junior_doctor", "assistant"];

/**
 * Role picker + per-permission toggles for the invite form. A toggle can
 * only turn OFF something the selected role would otherwise get — never
 * grant something outside its ceiling (see ROLE_PERMISSION_CEILING) — so
 * only that role's own permissions ever show up here. Submits as plain
 * form fields (role select + one hidden "deniedPermissions" input per
 * toggled-off permission) so the surrounding <form action={...}> server
 * action needs no changes to read it.
 */
export function StaffInviteFields() {
  const t = useTranslations("clinic");
  const [role, setRole] = useState<AssignableStaffRole>("receptionist");
  const [denied, setDenied] = useState<ReadonlySet<StaffPermissionKey>>(new Set());

  function selectRole(next: AssignableStaffRole) {
    setRole(next);
    // A denial only makes sense within the role it was toggled under —
    // the other role's ceiling may not even include the same key.
    setDenied(new Set());
  }

  function toggle(key: StaffPermissionKey) {
    setDenied((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <label>
        <span className="lbl">{t("roleLabel")}</span>
        <select
          name="role"
          className="field tap-target"
          value={role}
          onChange={(e) => selectRole(e.target.value as AssignableStaffRole)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="w-full">
        <span className="lbl">{t("permissionsToggleHeading")}</span>
        <div className="mt-2">
          {ROLE_PERMISSION_CEILING[role].map((key) => {
            const allowed = !denied.has(key);
            return (
              <div key={key} className="trow">
                <span>{t(`permissions.${key}`)}</span>
                <button
                  type="button"
                  className={`tg tap-target${allowed ? " on" : ""}`}
                  aria-pressed={allowed}
                  aria-label={t(`permissions.${key}`)}
                  onClick={() => toggle(key)}
                />
                {!allowed && <input type="hidden" name="deniedPermissions" value={key} />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
