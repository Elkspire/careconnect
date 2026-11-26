"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ROLE_PERMISSION_CEILING,
  type AssignableStaffRole,
  type StaffPermissionKey,
} from "@careconnect/shared-types";
import { FormField } from "@/components/ui/form-field";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

const ROLES: AssignableStaffRole[] = ["receptionist", "junior_doctor"];

const selectClasses =
  "tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600";

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
      <FormField label={t("roleLabel")}>
        <select
          name="role"
          className={selectClasses}
          value={role}
          onChange={(e) => selectRole(e.target.value as AssignableStaffRole)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </FormField>

      <div className="w-full">
        <span className="mb-1.5 block text-xs font-semibold text-text-label">
          {t("permissionsToggleHeading")}
        </span>
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {ROLE_PERMISSION_CEILING[role].map((key) => {
            const allowed = !denied.has(key);
            return (
              <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm text-text">{t(`permissions.${key}`)}</span>
                <ToggleSwitch
                  checked={allowed}
                  onChange={() => toggle(key)}
                  label={t(`permissions.${key}`)}
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
