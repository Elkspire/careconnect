"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteMyAccount } from "@/lib/api/account";
import { createClient } from "@/lib/supabase/server";

/** What the user must type to confirm. Kept in English in every language, like the button it unlocks. */
const CONFIRM_WORD = "DELETE";

export async function deleteAccountAction(formData: FormData): Promise<void> {
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== CONFIRM_WORD) {
    redirect("/account/delete?error=confirm");
  }

  try {
    await deleteMyAccount();
  } catch (err) {
    console.error(err);
    redirect("/account/delete?error=failed");
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
