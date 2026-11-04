import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getSupabaseEnv } from "./lib/supabase/env";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` (see
// AGENTS.md) — next-intl's own API is unchanged, only the file/export name.
const intlMiddleware = createMiddleware(routing);

// Longest first, so "/ur-Latn/..." isn't read as "/ur" + "-Latn/...".
const LOCALE_PREFIX = new RegExp(
  `^\/(${[...routing.locales].sort((a, b) => b.length - a.length).join("|")})(\/|$)`,
);

/** Locale-stripped path prefixes that require a signed-in session. */
const PROTECTED_PREFIXES = ["/patient", "/clinic", "/post-login", "/onboarding", "/account"];

export async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  let supabaseEnv;
  try {
    supabaseEnv = getSupabaseEnv();
  } catch {
    // No Supabase project configured yet (e.g. local dev before `supabase
    // start`) — let public pages keep working; protected API calls will
    // still 401 downstream, they just won't get this proxy-level redirect.
    return response;
  }

  // Refresh the Supabase session on every navigation, writing any refreshed
  // tokens to both the outgoing request (so this request sees them) and the
  // response next-intl already produced (redirect or otherwise) — this is
  // the "coarse" session check; individual server routes/actions must still
  // verify auth themselves (see Section 4 of the Phase 1 plan and Next's own
  // guidance in the proxy docs to never rely on it as the sole check).
  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const localeMatch = request.nextUrl.pathname.match(LOCALE_PREFIX);
  const locale = localeMatch?.[1] ?? routing.defaultLocale;
  const pathWithoutLocale = localeMatch
    ? request.nextUrl.pathname.slice(1 + locale.length) || "/"
    : request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathWithoutLocale.startsWith(prefix));
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    // Locale-less path: the login page's `next` redirect goes through
    // next-intl's locale-aware router, which re-prepends the locale itself.
    // Storing the already-prefixed pathname here produced `/en/en/...` 404s.
    loginUrl.searchParams.set("next", pathWithoutLocale + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Skip static assets, Next internals, and API-style paths — everything
  // else gets locale-prefixed and session-checked.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
