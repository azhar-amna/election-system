import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

const PROTECTED_VOTER_ROUTES = ["/dashboard", "/ballot"];
const PROTECTED_ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/register"];

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

  const { pathname } = request.nextUrl;
  const isAdminRoute = matchesRoute(pathname, PROTECTED_ADMIN_ROUTES);
  const isVoterRoute = matchesRoute(pathname, PROTECTED_VOTER_ROUTES);
  const isAuthRoute = matchesRoute(pathname, AUTH_ROUTES);

  // Skip auth round-trip for public routes when no Supabase auth cookie is present
  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));

  if (!isAdminRoute && !isVoterRoute && !isAuthRoute && !hasSupabaseAuthCookie) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.app_metadata?.role === "admin";

  if (!user && (isAdminRoute || isVoterRoute)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return createRedirectWithSessionCookies(loginUrl, supabaseResponse);
  }

  if (user && isAdminRoute && !isAdmin) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return createRedirectWithSessionCookies(dashboardUrl, supabaseResponse);
  }

  if (user && isVoterRoute && isAdmin) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = "/admin";
    adminUrl.search = "";
    return createRedirectWithSessionCookies(adminUrl, supabaseResponse);
  }

  if (user && isAuthRoute) {
    const portalUrl = request.nextUrl.clone();
    portalUrl.pathname = isAdmin ? "/admin" : "/dashboard";
    portalUrl.search = "";
    return createRedirectWithSessionCookies(portalUrl, supabaseResponse);
  }

  return supabaseResponse;
}
