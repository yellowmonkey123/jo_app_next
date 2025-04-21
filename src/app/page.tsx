// src/app/page.tsx
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/serverClient';

export default async function HomePage() {
  const supabase = getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/auth/signin');
  }
}