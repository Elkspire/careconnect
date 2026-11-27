"use client";

import { ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";

export interface Branch {
  clinicSlug: string;
  clinicName: string;
  roleLabel: string;
}

/**
 * The clinic sidebar's footer, as in the prototype: which branch (clinic)
 * this is, and a switch to another one this person works at. Choosing one
 * opens the same section (Today, Patients, ...) at that clinic. With only
 * one clinic it just names it.
 */
export function BranchSwitcher({
  branches,
  current,
  heading,
  note,
}: {
  branches: Branch[];
  current: string;
  heading: string;
  /** e.g. "Record access is logged". */
  note: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // /clinic/<slug>/<section>/...: keep the section, not a patient or visit
  // that belongs to this clinic only.
  const section = pathname.split("/")[3] ?? "today";
  const currentBranch = branches.find((b) => b.clinicSlug === current);

  return (
    <div className="rounded-lg bg-navy-hover/60 p-3">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-navy-fg uppercase">
          {heading}
        </span>
        {branches.length > 1 ? (
          <select
            value={current}
            onChange={(e) => router.push(`/clinic/${e.target.value}/${section}`)}
            className="tap-target w-full rounded-md border border-white/15 bg-navy px-2.5 py-2 text-sm text-white focus:outline-2 focus:outline-offset-1 focus:outline-[#7fe3da]"
          >
            {branches.map((b) => (
              <option key={b.clinicSlug} value={b.clinicSlug}>
                {b.clinicName} · {b.roleLabel}
              </option>
            ))}
          </select>
        ) : (
          <span className="block rounded-md border border-white/15 px-2.5 py-2 text-sm text-white">
            {currentBranch?.clinicName}
          </span>
        )}
      </label>
      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-[#7fe3da]">
        <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
        {note}
      </p>
    </div>
  );
}
