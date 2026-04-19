import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PROTECTED_ROUTES: string[] = [];
const AUTH_ROUTES = ["/login", "/signup"];

function isRouteMatch(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    ({ supabaseUrl, supabaseAnonKey } = getSupabaseEnv());
  } catch {
    // Keep public pages accessible if env vars are missing in a deployment.
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let user: { id: string } | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    // If auth lookup fails, continue with passthrough response instead of failing the request.
    return response;
  }

  const { pathname, search } = request.nextUrl;
  const wantsProtectedRoute = isRouteMatch(pathname, PROTECTED_ROUTES);
  const isAuthRoute = isRouteMatch(pathname, AUTH_ROUTES);

  if (!user && wantsProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/learn", request.url));
  }

  return response;
}
