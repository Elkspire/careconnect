"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { FormResult } from "@/lib/form-result";
import { deleteMyAccount } from "@/lib/api/account";
import { createClient } from "@/lib/supabase/server";

/** What the user must type to confirm. Kept in English in every language, like the button it unlocks. */
const CONFIRM_WORD = "DELETE";

/** Shown in the confirmation dialog: an error keeps it open; success leaves the site. */
export async function deleteAccountAction(formData: FormData): Promise<FormResult> {
  const t = await getTranslations("account");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== CONFIRM_WORD) {
    return { status: "error", message: t("confirmMismatch") };
  }

  try {
    await deleteMyAccount();
  } catch (err) {
    console.error(err);
    return { status: "error", message: t("deleteFailed") };
  }

  // The login no longer exists, so Supabase may refuse to revoke the
  // session — sign out anyway, then drop any session cookies it left, so
  // the browser isn't holding a session for a deleted user.
  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => undefined);
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name.startsWith("sb-")) jar.delete(c.name);
  }

  redirect("/?accountDeleted=1");
}
