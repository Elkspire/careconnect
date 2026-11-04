import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles a clicked email magic link. Sign-in is phone-only now and the
 * typed SMS code resolves a session directly in the browser via
 * verifyOtp(), so nothing in the app sends people here anymore — kept so
 * any magic link already sitting in someone's inbox from the email-login
 * era still lands somewhere sensible instead of a 404.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/post-login";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    // iOS (Mail/Safari link prefetching) commonly hits this route twice for
    // the same tap — the first request consumes the one-time code and
    // creates a real session, the second reuses the now-dead code and lands
    // here. Bouncing that second request to /login is wrong: the session
    // from the first request already exists in this same browser. Only
    // send them to /login if there's genuinely no session either way.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
