import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { SNAP_CONSENT_COOKIE, parseSnapConsent } from '@/lib/snap-consent'

export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return new NextResponse(null, { status: 403 })
  const consent = parseSnapConsent(request.cookies.get(SNAP_CONSENT_COOKIE)?.value)
  if (!consent) return new NextResponse(null, { status: 204 })
  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) return new NextResponse(null, { status: 503 })
  const { createClient } = await import('@supabase/supabase-js')
  const { error } = await createClient(url, key).from('snap_purchase_outbox')
    .update({ revoked_at: new Date().toISOString(), sc_click_id: null, sc_cookie1: null })
    .eq('consent_id', consent.receipt).is('sent_at', null)
  return new NextResponse(null, { status: error ? 503 : 204 })
}
