import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { publicRateLimit } from '@/lib/public-rate-limit'
import {
  TIKTOK_CONSENT_COOKIE,
  TIKTOK_CONSENT_MAX_AGE,
  TIKTOK_PIXEL_CONSENT_COOKIE,
  TIKTOK_SETTINGS_CONSENT_VERSION,
  tiktokConsentId,
} from '@/lib/tiktok-consent'

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return new NextResponse(null, { status: 403 })
  const body = await request.json().catch(() => null)
  if (typeof body?.enabled !== 'boolean') return new NextResponse(null, { status: 400 })
  const enabled: boolean = body.enabled
  if (enabled && request.headers.get('sec-gpc') === '1') return new NextResponse(null, { status: 403 })

  const id = tiktokConsentId(request.cookies.get(TIKTOK_CONSENT_COOKIE)?.value)
  const response = NextResponse.json({ enabled })
  const options = { path: '/', sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' }
  if (enabled || id) {
    const { url, key } = getSupabaseServerEnv()
    if (!url || !key) return new NextResponse(null, { status: 503 })
    const db = createClient(url, key)
    if (enabled) {
      const limited = await publicRateLimit(request, 'tiktok-consent', 12)
      if (limited) return limited
      const existing = id && await db.from('tiktok_consent_receipts').select('id,expires_at')
        .eq('id', id).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
      if (existing && existing.error) return new NextResponse(null, { status: 503 })
      const { data, error } = existing && existing.data ? existing : await db.from('tiktok_consent_receipts')
        .insert({ version: TIKTOK_SETTINGS_CONSENT_VERSION }).select('id,expires_at').single()
      if (error || !data) return new NextResponse(null, { status: 503 })
      const maxAge = Math.min(TIKTOK_CONSENT_MAX_AGE, Math.floor((Date.parse(data.expires_at) - Date.now()) / 1000))
      response.cookies.set(TIKTOK_CONSENT_COOKIE, data.id, { ...options, httpOnly: true, maxAge })
      response.cookies.set(TIKTOK_PIXEL_CONSENT_COOKIE, '1', { ...options, maxAge })
      return response
    }
    const { error } = await db.from('tiktok_consent_receipts')
      .update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null)
    if (error) return new NextResponse(null, { status: 503 })
  }

  response.cookies.set(TIKTOK_CONSENT_COOKIE, '', { ...options, httpOnly: true, maxAge: 0 })
  response.cookies.set(TIKTOK_PIXEL_CONSENT_COOKIE, '', { ...options, maxAge: 0 })
  return response
}
