import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Environment variables with runtime validation
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.');
}

export async function middleware(req: NextRequest) {
  const supabase = createServerClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
    },
  });

  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch (error) {
    console.error('Middleware - Error fetching session:', error);
    const signInUrl = new URL('/auth/signin', req.url);
    return NextResponse.redirect(signInUrl);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Middleware - Session:', session ? 'Exists' : 'Not Found');
    console.log('Middleware - Cookies:', req.cookies.get('sb-fgzikamdhtleohmktogb-auth-token'));
  }

  const { pathname } = req.nextUrl;

  if (!session && !pathname.startsWith('/auth')) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Middleware - Redirecting to /auth/signin from:', pathname);
    }
    const signInUrl = new URL('/auth/signin', req.url);
    return NextResponse.redirect(signInUrl);
  }

  if (session && pathname.startsWith('/auth')) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Middleware - Redirecting to /dashboard from:', pathname);
    }
    const dashUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/startup/:path*', '/shutdown/:path*', '/habits/:path*', '/settings/:path*', '/weekly-report/:path*'],
};