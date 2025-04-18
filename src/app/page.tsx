// src/app/page.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/ssr'
import type { Database } from '@/lib/types'  // adjust path if your types lives elsewhere

export default async function Home() {
  // Initialize a Supabase client that runs on the server,
  // using the incoming request cookies to read the session.
  const supabase = createServerComponentClient<Database>({ cookies })

  // Fetch the session
  const {
    data: { session },
    error
  } = await supabase.auth.getSession()

  // If there's an error or no session, redirect to sign‑in
  if (error || !session) {
    return redirect('/auth/signin')
  }

  // Otherwise send the user straight to dashboard
  return redirect('/dashboard')
}
