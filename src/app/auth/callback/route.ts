import { NextRequest, NextResponse } from 'next/server'
import { safeAuthPath } from '@/lib/auth-redirect'
import { POLICY_COOKIE } from '@/lib/policy-consent'
import { newsletterDb } from '@/lib/newsletter'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeAuthPath(searchParams.get('next'))
  if (code) {
    const { createServerClient } = await import('@supabase/ssr')
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: (s: any[]) => { s.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options)) } }
    })
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const receipt = cookieStore.get(POLICY_COOKIE)?.value
      if (receipt && /^[0-9a-f-]{36}$/.test(receipt) && data.user) {
        try {
          const db = newsletterDb()
          const { data: consent } = await db.from('policy_consents').select('email,source').eq('id', receipt).is('user_id', null).gte('accepted_at', new Date(Date.now() - 3600000).toISOString()).maybeSingle()
          if (consent && (consent.source === 'google_register' || consent.email === data.user.email?.toLowerCase())) {
            await db.from('policy_consents').update({ user_id: data.user.id, verified_at: new Date().toISOString() }).eq('id', receipt).is('user_id', null)
          }
        } catch { console.warn('[policy] account receipt association unavailable') }
        cookieStore.delete(POLICY_COOKIE)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
