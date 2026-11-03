import { randomUUID } from 'node:crypto'
import { getAdminDb } from '@/lib/admin-db'
import { decryptSnapTokens, encryptSnapTokens, SNAP_MARKETING_CALLBACK, SNAP_MARKETING_ORG } from '@/lib/snap-marketing-crypto'

type SnapTokens = { access_token: string; refresh_token: string; expires_at: number }
export type SnapAdAccount = { id: string; name: string; currency: string; status: string; timezone: string }
const API = 'https://adsapi.snapchat.com/v1'

export async function exchangeSnapTokens(fields: Record<string, string>, previousRefreshToken?: string): Promise<SnapTokens> {
  const clientId = process.env.SNAP_MARKETING_CLIENT_ID
  const clientSecret = process.env.SNAP_MARKETING_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Snap credentials are not configured')
  const response = await fetch('https://accounts.snapchat.com/login/oauth2/access_token', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...fields, client_id: clientId, client_secret: clientSecret, redirect_uri: SNAP_MARKETING_CALLBACK }),
  })
  // Provider bodies can contain credentials; never log or forward them.
  if (!response.ok) throw new Error('Snap token exchange failed')
  const data = await response.json()
  const refresh = data.refresh_token || previousRefreshToken
  if (typeof data.access_token !== 'string' || !data.access_token || typeof refresh !== 'string' || !refresh
    || !Number.isFinite(data.expires_in) || data.expires_in <= 0
    || (data.token_type && data.token_type.toLowerCase() !== 'bearer')
    || (data.scope && !String(data.scope).split(' ').includes('snapchat-marketing-api'))) {
    throw new Error('Invalid Snap token response')
  }
  return { access_token: data.access_token, refresh_token: refresh, expires_at: Date.now() + data.expires_in * 1000 }
}

// Only this organisation's ad accounts are exposed. Provider pagination must
// remain on the same origin and path; no user-supplied or arbitrary API URLs.
export async function listSnapAdAccounts(accessToken: string): Promise<SnapAdAccount[]> {
  const path = `/v1/organizations/${SNAP_MARKETING_ORG}/adaccounts`
  let url: string | null = `https://adsapi.snapchat.com${path}`
  const accounts: SnapAdAccount[] = []
  for (let page = 0; url && page < 20; page++) {
    const parsed: URL = new URL(url)
    if (parsed.origin !== 'https://adsapi.snapchat.com' || parsed.pathname !== path || parsed.username || parsed.password) throw new Error('Invalid Snap pagination')
    const response = await fetch(parsed, {
      cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new Error('Snap ad accounts could not be loaded')
    const body = await response.json()
    if (body.request_status !== 'SUCCESS' || !Array.isArray(body.adaccounts)) throw new Error('Invalid Snap account response')
    for (const item of body.adaccounts) {
      const account = item.adaccount
      if (item.sub_request_status !== 'SUCCESS' || !account?.id) throw new Error('Invalid Snap ad account')
      if (account.organization_id && account.organization_id !== SNAP_MARKETING_ORG) throw new Error('Unexpected Snap organisation')
      accounts.push({ id: account.id, name: account.name, currency: account.currency, status: account.status, timezone: account.timezone })
    }
    url = body.paging?.next_link ? new URL(body.paging.next_link, API).toString() : null
  }
  if (url) throw new Error('Snap pagination limit reached')
  return accounts
}

export async function saveSnapConnection(tokens: SnapTokens, connectedBy: string) {
  const { error } = await getAdminDb().from('snap_marketing_connections').upsert({
    organization_id: SNAP_MARKETING_ORG, token_ciphertext: encryptSnapTokens(tokens),
    expires_at: new Date(tokens.expires_at).toISOString(), connected_by: connectedBy,
    connected_at: new Date().toISOString(), version: randomUUID(), refresh_lock_until: null,
  }, { onConflict: 'organization_id' })
  if (error) throw new Error('Snap connection could not be saved')
}

export async function getSnapAccessToken(): Promise<string> {
  const db = getAdminDb()
  const { data: connection, error } = await db.from('snap_marketing_connections').select('*').eq('organization_id', SNAP_MARKETING_ORG).maybeSingle()
  if (error || !connection) throw new Error('Snap is not connected')
  const current = decryptSnapTokens<SnapTokens>(connection.token_ciphertext)
  if (current.expires_at > Date.now() + 60_000) return current.access_token

  const now = new Date().toISOString()
  const { data: lease, error: leaseError } = await db.from('snap_marketing_connections')
    .update({ refresh_lock_until: new Date(Date.now() + 30_000).toISOString() })
    .eq('organization_id', SNAP_MARKETING_ORG).eq('version', connection.version)
    .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${now}`).select('organization_id').maybeSingle()
  if (leaseError || !lease) throw new Error('Snap token refresh in progress; retry shortly')
  try {
    const refreshed = await exchangeSnapTokens({ grant_type: 'refresh_token', refresh_token: current.refresh_token }, current.refresh_token)
    const { data: saved, error: saveError } = await db.from('snap_marketing_connections').update({
      token_ciphertext: encryptSnapTokens(refreshed), expires_at: new Date(refreshed.expires_at).toISOString(),
      version: randomUUID(), refresh_lock_until: null,
    }).eq('organization_id', SNAP_MARKETING_ORG).eq('version', connection.version).select('organization_id').maybeSingle()
    if (saveError || !saved) throw new Error('Snap refreshed token could not be saved')
    return refreshed.access_token
  } catch {
    await db.from('snap_marketing_connections').update({ refresh_lock_until: null })
      .eq('organization_id', SNAP_MARKETING_ORG).eq('version', connection.version)
    throw new Error('Snap token refresh failed; reconnect if the problem persists')
  }
}
