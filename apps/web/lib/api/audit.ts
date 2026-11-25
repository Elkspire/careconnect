import type { AuditFailure } from "@careconnect/shared-types";
import { ApiError } from "./authedFetch";

/**
 * Reading or changing medical data fails when the API can't save its audit
 * entry (see its AuditLogInterceptor). These turn that into a notice on the
 * page instead of an error screen; every other error is thrown on.
 */
function failedWith(err: unknown, code: AuditFailure): boolean {
  return err instanceof ApiError && err.code === code;
}

/** What was asked for, or null if the API refused to show it unrecorded. */
export async function unlessRefused<T extends object>(view: Promise<T>): Promise<T | null> {
  try {
    return await view;
  } catch (err) {
    if (failedWith(err, "audit_view_refused")) return null;
    throw err;
  }
}

/** The result, or null if the change WAS saved but the API couldn't record it. */
export async function orSavedUnrecorded<T extends object>(change: Promise<T>): Promise<T | null> {
  try {
    return await change;
  } catch (err) {
    if (failedWith(err, "audit_change_saved")) return null;
    throw err;
  }
}

/**
 * Like orSavedUnrecorded, for a change whose result must reach the user either
 * way: whether it was recorded, and what `fromFailure` finds in the failure.
 */
export async function savedEitherWay<T>(
  change: Promise<T>,
  fromFailure: (body: Record<string, unknown>) => T,
): Promise<{ result: T; recorded: boolean }> {
  try {
    return { result: await change, recorded: true };
  } catch (err) {
    if (err instanceof ApiError && failedWith(err, "audit_change_saved")) {
      return { result: fromFailure(err.body), recorded: false };
    }
    throw err;
  }
}

/** Passed back to the page as ?audit=, for AuditNotice. */
export const AUDIT_NOTICE = ["refused", "saved"] as const;
export type AuditNoticeKind = (typeof AUDIT_NOTICE)[number];

export function auditNoticeFrom(param: string | string[] | undefined): AuditNoticeKind | undefined {
  return AUDIT_NOTICE.find((kind) => kind === param);
}
