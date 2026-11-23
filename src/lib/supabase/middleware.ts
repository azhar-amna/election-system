import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

const PROTECTED_VOTER_ROUTES = ["/dashboard", "/ballot"];
const PROTECTED_ADMIN_ROUTES = ["/admin"];

function matchesRoute(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function createRedirectWithSessionCookies(
  targetUrl: URL,
  sourceResponse: NextResponse
): NextResponse {
  const redirectResponse = NextResponse.redirect(targetUrl);

  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  const cacheControl = sourceResponse.headers.get("Cache-Control");
  if (cacheControl) {
    redirectResponse.headers.set("Cache-Control", cacheControl);
  }

  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Always verify auth on the server via getUser() rather than trusting getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = matchesRoute(pathname, PROTECTED_ADMIN_ROUTES);
  const isVoterRoute = matchesRoute(pathname, PROTECTED_VOTER_ROUTES);
  const isAdmin = user?.app_metadata?.role === "admin";

  // 1. Unauthenticated visitors attempting to access protected routes -> /login
  if (!user && (isAdminRoute || isVoterRoute)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return createRedirectWithSessionCookies(loginUrl, supabaseResponse);
  }

  // 2. Non-admin users attempting to access /admin -> /dashboard
  if (user && isAdminRoute && !isAdmin) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return createRedirectWithSessionCookies(dashboardUrl, supabaseResponse);
  }

  // 3. Admin users attempting to access voter routes (/dashboard, /ballot) -> /admin
  if (user && isVoterRoute && isAdmin) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = "/admin";
    adminUrl.search = "";
    return createRedirectWithSessionCookies(adminUrl, supabaseResponse);
  }

  return supabaseResponse;
}
