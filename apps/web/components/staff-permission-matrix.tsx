"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  STAFF_PERMISSION_KEYS,
  isPermissionGranted,
  type AssignableStaffRole,
} from "@/lib/staff-permissions";
import { ListRow } from "@/components/ui/list-row";
import { Badge } from "@/components/ui/badge";

const ROLES: AssignableStaffRole[] = ["receptionist", "junior_doctor"];

/** Lets a doctor pick a role and see exactly what it can and can't reach,
 * before assigning it in the invite form below. */
export function StaffPermissionMatrix() {
  const t = useTranslations("clinic");
  const [role, setRole] = useState<AssignableStaffRole>("receptionist");

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {t("permissionsHeading")}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            className={`tap-target rounded-md border px-3 py-1.5 text-sm font-medium transition ${
              r === role
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-border text-text-muted hover:border-primary-500"
            }`}
            aria-pressed={r === role}
            onClick={() => setRole(r)}
          >
            {t(`roles.${r}`)}
          </button>
        ))}
      </div>
      <div className="rounded-md border border-border">
        {STAFF_PERMISSION_KEYS.map((key) => {
          const allowed = isPermissionGranted(role, key);
          return (
            <ListRow
              key={key}
              title={t(`permissions.${key}`)}
              meta={
                <Badge tone={allowed ? "green" : "gray"}>
                  {allowed ? t("permissionAllowed") : t("permissionBlocked")}
                </Badge>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
