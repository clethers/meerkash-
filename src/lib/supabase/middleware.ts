import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/env';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/auth', '/join'];

export async function updateSession(request: NextRequest) {
  // No credentials yet: let every page through so the setup screen can render.
  if (!supabaseConfigured) return NextResponse.next({ request });

  let pendingCookies: Array<{ name: string; value: string; options?: CookieOptions }> = [];

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          pendingCookies = cookiesToSet;
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Built after getUser() resolves, so any cookie refresh from setAll above
  // is already reflected in request.cookies, and the header carries exactly
  // one verified x-user-id value — never a client-supplied one.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-user-id');
  if (user) requestHeaders.set('x-user-id', user.id);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    const response = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }

  if (user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/groups';
    url.search = '';
    const response = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
