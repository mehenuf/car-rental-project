import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/admin/login";
const DASHBOARD_PATH = "/admin";

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
export async function proxy(request: NextRequest) {
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

  if (isAdmin && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = DASHBOARD_PATH;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
