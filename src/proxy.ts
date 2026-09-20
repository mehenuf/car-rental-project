import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/lib/i18n/locales";
import { isUnprefixedPath, negotiateLocale, stripLocale, withLocale } from "@/lib/i18n/negotiate";

const LOGIN_PATH = "/admin/login";
const DASHBOARD_PATH = "/admin";
const MFA_PATH = "/admin/mfa";

/**
 * Gates every /admin/* route behind an admin session. Uses
 * `supabase.auth.getUser()` (not `getSession()`) because that call revalidates
 * the token against Supabase's Auth server instead of trusting the cookie's
 * claims blindly, and it also refreshes/rewrites the session cookie on the
 * response so long admin sessions don't silently expire.
 *
 * Customers can self-register (see /register) into the same Supabase Auth
 * table admins live in, so "has a session" is no longer sufficient — a
 * logged-in customer must NOT pass this check. Admin status is the
 * `role: "admin"` custom claim in `app_metadata`, which (unlike
 * `user_metadata`) can only be set server-side with the service role key —
 * see promote-admin.ts. A logged-in-but-non-admin visitor is treated the
 * same as a logged-out one: bounced to /admin/login, which shows the login
 * form rather than looping, since `isAdmin` is false there too.
 */
async function adminGate(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = !!user && user.app_metadata?.role === "admin";
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;

  if (!isAdmin && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    return NextResponse.redirect(url);
  }

  // Staff must complete a second factor in this session before reaching any admin page.
  // Off by default; turn on with ADMIN_REQUIRE_MFA=true.
  if (isAdmin && process.env.ADMIN_REQUIRE_MFA === "true" && request.nextUrl.pathname !== MFA_PATH && !isLoginPage) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = MFA_PATH;
      return NextResponse.redirect(url);
    }
  }

  if (isAdmin && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = DASHBOARD_PATH;
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * Public pages live under a language prefix (/en/cars, /ar/cars). A request without
 * one is redirected to the negotiated language: saved cookie, then Accept-Language,
 * then the visitor country header. The admin console and provider portal stay
 * unprefixed (English), and admin requests are gated as before.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGate(request);
  if (isUnprefixedPath(pathname)) return NextResponse.next();
  if (stripLocale(pathname).locale) return NextResponse.next();

  const locale = negotiateLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
    country: request.headers.get("x-vercel-ip-country"),
  });
  const url = request.nextUrl.clone();
  const target = withLocale(locale, pathname + search);
  const [path, query] = target.split("?");
  url.pathname = path!;
  url.search = query ? "?" + query : "";
  return NextResponse.redirect(url);
}

// Everything except API routes, Next internals and files with an extension.
export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
