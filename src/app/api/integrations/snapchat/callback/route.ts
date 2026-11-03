import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { matchesSnapState, snapStateHash, SNAP_MARKETING_COOKIE, SNAP_MARKETING_ORIGIN } from '@/lib/snap-marketing-crypto'
import { exchangeSnapTokens, listSnapAdAccounts, saveSnapConnection } from '@/lib/snap-marketing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function finish(result: string) {
  const response = NextResponse.redirect(`${SNAP_MARKETING_ORIGIN}/admin/snapchat?result=${result}`, 303)
  response.cookies.set(SNAP_MARKETING_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin(request, ['super_admin'])
  if (error) return error
  const state = request.nextUrl.searchParams.get('state')
  if (!matchesSnapState(state, request.cookies.get(SNAP_MARKETING_COOKIE)?.value)) return finish('invalid_state')
  // Atomic deletion consumes the state exactly once, bound to this admin session.
  const { data, error: stateError } = await getAdminDb().from('snap_marketing_oauth_states').delete()
    .eq('state_hash', snapStateHash(state!)).eq('admin_id', user!.id)
    .gt('expires_at', new Date().toISOString()).select('state_hash').maybeSingle()
  if (stateError || !data) return finish('expired_state')
  const code = request.nextUrl.searchParams.get('code')
  if (request.nextUrl.searchParams.has('error') || !code || code.length > 4096) return finish('denied')
  try {
    const tokens = await exchangeSnapTokens({ grant_type: 'authorization_code', code })
    await listSnapAdAccounts(tokens.access_token) // Verify access to RWNAK before saving.
    await saveSnapConnection(tokens, user!.id)
    return finish('connected')
  } catch {
    // Do not log the callback URL, auth code, provider response or token data.
    return finish('connection_failed')
  }
}
