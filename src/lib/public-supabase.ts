import { createClient } from '@supabase/supabase-js'

let browserClient: ReturnType<typeof newPublicClient> | undefined

function newPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { storageKey: 'rwnak-public-content', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
}

// Public copy reads never use the customer's auth storage or session.
// Reuse only in the browser; each server request receives its own client.
export function getPublicSupabase() {
  const inBrowser = typeof window !== 'undefined'
  if (inBrowser && browserClient) return browserClient
  const client = newPublicClient()
  if (inBrowser) browserClient = client
  return client
}
