import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

// Helper function to create a Supabase client with cookie handling
const createSupabaseClient = (req: NextRequest, response: NextResponse) => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );
};

// Handler for GET and POST requests (session fetching)
export const GET = async (req: NextRequest) => {
  // eslint-disable-next-line prefer-const
  let response = NextResponse.next({ // Line 37
    request: {
      headers: req.headers,
    },
  });

  const supabase = createSupabaseClient(req, response);

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error fetching session in API route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.log('API Route - Session:', data);

  return response;
};

export const POST = GET; // Reuse the same handler for POST

export const DELETE = async (req: NextRequest) => {
  // eslint-disable-next-line prefer-const
  let response = NextResponse.next({ // Line 58
    request: {
      headers: req.headers,
    },
  });

  const supabase = createSupabaseClient(req, response);

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out in API route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.log('API Route - Signed out successfully');

  return NextResponse.json({ message: 'Signed out' });
};

export const dynamic = 'force-dynamic';