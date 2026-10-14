import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' }

// Opening an email (or an email scanner's GET) never consumes its single-use token.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token_hash') ?? ''
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  return new NextResponse(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>استرجاع كلمة المرور — رونق</title><body style="font-family:Tahoma,Arial,sans-serif;background:#faf8ff;color:#1A1228;display:flex;min-height:95vh;align-items:center;justify-content:center"><main style="max-width:400px;margin:24px;padding:32px;background:white;border-radius:20px;text-align:center"><h1>استرجاع كلمة المرور</h1><p>اضغطي متابعة لتعيين كلمة مرور جديدة لحسابك.</p><form method="post" action="/auth/recovery"><input type="hidden" name="token_hash" value="${token}"><button style="background:#6747B2;color:white;border:0;border-radius:10px;padding:14px 28px;font:inherit;cursor:pointer">متابعة</button></form></main></body></html>`, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin
  if (request.headers.get('origin') !== origin) return NextResponse.json({ error: 'Invalid request' }, { status: 403, headers })
  let token: string
  try { token = String((await request.formData()).get('token_hash') ?? '') }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers }) }
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) return NextResponse.redirect(new URL('/login?error=auth_failed', request.url), 303)
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: values => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
    })
    // Recovery only: no PKCE verifier from the original browser is required.
    const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' })
    if (!error) {
      const response = NextResponse.redirect(new URL('/reset-password', request.url), 303)
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }
  } catch { /* Do not log recovery secrets. Show the retry page. */ }
  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url), 303)
}
