export const SNAP_SOURCE_COOKIE = 'rwnak_snap_source'
const MAX_AGE = 30 * 86400000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const label = (value: unknown) => typeof value === 'string' && /^[a-z0-9_-]{1,100}$/i.test(value) ? value : null

export type SnapAttribution = { source: 'snapchat'; medium: 'paid_social' | 'organic'; account: string | null; campaign: string | null; content: string | null; at: number }

export function parseSnapAttribution(raw: string | undefined, now = Date.now()): SnapAttribution | null {
  try {
    if (!raw || raw.length > 2048) return null
    const value = JSON.parse(decodeURIComponent(raw))
    if (value.source !== 'snapchat' || !['paid_social', 'organic'].includes(value.medium)
      || !Number.isSafeInteger(value.at) || value.at > now || now - value.at > MAX_AGE) return null
    return { source: 'snapchat', medium: value.medium, account: UUID.test(value.account ?? '') ? value.account : null,
      campaign: label(value.campaign), content: label(value.content), at: value.at }
  } catch { return null }
}

// undefined keeps the previous non-expired touch on a direct visit. null
// clears it on a visit carrying another source; no click IDs are stored here.
export function snapAttributionFromUrl(raw: string, now = Date.now()): SnapAttribution | null | undefined {
  const url = new URL(raw)
  const source = url.searchParams.get('utm_source')?.toLowerCase()
  const snapClick = UUID.test(url.searchParams.get('ScCid') ?? '')
  if (source && !['snap', 'snapchat'].includes(source)) return null
  if (!source && !snapClick) return undefined
  const medium = url.searchParams.get('utm_medium')?.toLowerCase()
  return { source: 'snapchat', medium: medium === 'paid_social' || snapClick ? 'paid_social' : 'organic',
    account: UUID.test(url.searchParams.get('utm_term') ?? '') ? url.searchParams.get('utm_term') : null,
    campaign: label(url.searchParams.get('utm_campaign')), content: label(url.searchParams.get('utm_content')), at: now }
}
