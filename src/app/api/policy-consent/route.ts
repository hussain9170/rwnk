import { NextRequest, NextResponse } from 'next/server'
import { publicRateLimit } from '@/lib/public-rate-limit'
import { POLICY_COOKIE, POLICY_VERSION } from '@/lib/policy-consent'
import { newsletterDb } from '@/lib/newsletter'

export async function POST(request: NextRequest) {
  const limited = await publicRateLimit(request, 'policy-consent', 10, 600)
  if (limited) return limited
  try {
    const body = await request.json()
    if (body.accepted !== true || body.version !== POLICY_VERSION || !['register', 'google_register'].includes(body.source)) return NextResponse.json({ error: 'يرجى الموافقة على الشروط والاطّلاع على الخصوصية.' }, { status: 400 })
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null
    if (body.source === 'register' && (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: 'البريد غير صحيح.' }, { status: 400 })
    const { data, error } = await newsletterDb().from('policy_consents').insert({ email, source: body.source, policy_version: POLICY_VERSION }).select('id').single()
    if (error || !data) throw new Error('Consent not saved')
    const response = NextResponse.json({ ok: true })
    response.cookies.set(POLICY_COOKIE, data.id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 })
    return response
  } catch { return NextResponse.json({ error: 'تعذّر حفظ الموافقة، حاولي مرة أخرى.' }, { status: 503 }) }
}
