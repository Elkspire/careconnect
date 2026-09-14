import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles a clicked email magic link. The rest of the app's auth flow never
 * needed this — signing in by typing the OTP code (phone or email) resolves
 * a session directly in the browser via verifyOtp(), no redirect involved.
 * But Supabase's default email template always includes a clickable link
 * alongside the code, and clicking it lands here with a PKCE `?code=` to
 * exchange for a session server-side (see login/page.tsx's emailRedirectTo).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/post-login";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/${locale}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login`);
}
