import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware-context Supabase session handler.
//
// Two reasons middleware-context is its own helper, distinct from
// getServerSupabase() (Server Components / Server Actions):
//   1. Middleware reads cookies from NextRequest, not next/headers.
//   2. Middleware can write cookies — Server Components cannot. The
//      auth library uses this hook to refresh the access token when
//      it rotates, before any downstream Server Component reads the
//      session.
//
// This function also enforces the /admin/* boundary: unauthenticated
// requests to anything under /admin (other than the login page itself)
// are redirected to /admin/login. Already-authenticated users hitting
// /admin/login are redirected to /admin.
export async function updateAdminSession(
  request: NextRequest,
): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "updateAdminSession requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser triggers the access-token refresh path inside @supabase/ssr,
  // which is why this lives in middleware (cookie writes happen here).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPath = path === "/admin/login";

  if (!user && !isLoginPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginPath) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = "/admin";
    return NextResponse.redirect(adminUrl);
  }

  return response;
}
