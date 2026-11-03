import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { snapMarketingConfigured, snapStateHash, SNAP_MARKETING_CALLBACK, SNAP_MARKETING_COOKIE, SNAP_MARKETING_ORIGIN } from '@/lib/snap-marketing-crypto'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request, ['super_admin'])
  if (error) return error
  if (request.headers.get('origin') !== SNAP_MARKETING_ORIGIN || request.nextUrl.origin !== SNAP_MARKETING_ORIGIN) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }
  if (!snapMarketingConfigured()) return NextResponse.json({ error: 'إعداد ربط سناب غير مكتمل' }, { status: 503 })
  const state = randomBytes(32).toString('hex')
  const db = getAdminDb()
  await db.from('snap_marketing_oauth_states').delete().lt('expires_at', new Date().toISOString())
  const { error: stateError } = await db.from('snap_marketing_oauth_states').insert({
    state_hash: snapStateHash(state), admin_id: user!.id, expires_at: new Date(Date.now() + 600_000).toISOString(),
  })
  if (stateError) return NextResponse.json({ error: 'تعذر بدء تفويض سناب' }, { status: 503 })
  const url = new URL('https://accounts.snapchat.com/login/oauth2/authorize')
  url.search = new URLSearchParams({ client_id: process.env.SNAP_MARKETING_CLIENT_ID!, redirect_uri: SNAP_MARKETING_CALLBACK,
    response_type: 'code', scope: 'snapchat-marketing-api', state }).toString()
  // Return the destination to the admin client, which navigates separately.
  // A native POST + cross-origin 303 is blocked by our strict form-action CSP.
  const response = NextResponse.json({ authorizeUrl: url.toString() })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.cookies.set(SNAP_MARKETING_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 })
  return response
}
