import { NextRequest, NextResponse } from 'next/server'
import { safeAuthPath } from '@/lib/auth-redirect'
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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
