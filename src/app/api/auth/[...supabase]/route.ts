// src/app/api/auth/[...supabase]/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types';

export const GET = async () => {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data, error } = await supabase.auth.getSession();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
};

export const POST = async () => {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error setting session cookie:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ message: 'Session cookie set' });
};

export const DELETE = async () => {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: 'Signed out' });
};