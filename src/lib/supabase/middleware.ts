import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/env';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/auth', '/join'];

export async function updateSession(request: NextRequest) {
  // No credentials yet: let every page through so the setup screen can render.
  if (!supabaseConfigured) return NextResponse.next({ request });

  const requestHeaders = new Headers(request.headers);
  // Strip any client-supplied value up front — it must only ever be set by
  // the verified branch below, never pass through from an incoming request.
  requestHeaders.delete('x-user-id');
  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Session is verified against the Auth server right here — forward the id
  // downstream so Server Components (getAuthUser) don't pay for a second,
  // redundant getUser() round trip for the same request.
  if (user) {
    requestHeaders.set('x-user-id', user.id);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/groups';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
