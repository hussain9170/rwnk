// Public pixel code, not an API credential. Never load this SDK on receipt,
// authentication or account URLs: those may contain download/access tokens.
export const TIKTOK_PIXEL_CODE = 'DBMFUP3C77UA5QM455NG'
const PUBLIC_PATH = /^\/(?:$|checkout\/?$|about\/?$|privacy\/?$|terms\/?$|refund\/?$|blog(?:\/[a-z0-9-]+)?\/?$)/
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'ttclid']

type TikTokQueue = unknown[][] & {
  page?: () => void
  track?: (event: string, data?: Record<string, unknown>) => void
  methods?: string[]
  setAndDefer?: (target: unknown[][], method: string) => void
  instance?: (code: string) => unknown[][]
  _i?: Record<string, unknown[] & { _u?: string }>
  _t?: Record<string, number>
  _o?: Record<string, Record<string, unknown>>
}
declare global { interface Window { ttq?: TikTokQueue; TiktokAnalyticsObject?: string } }

export function isPublicTikTokUrl(raw: string, origin = 'https://www.rwnak.net') {
  if (!raw) return true
  try {
    const url = new URL(raw, origin)
    if (!PUBLIC_PATH.test(decodeURIComponent(url.pathname)) || url.hash) return false
    return [...url.searchParams].every(([key, value]) => {
      if (key === 'lang') return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(value)
      return CAMPAIGN_KEYS.includes(key) && /^[a-z0-9_.,~+%:/ -]{0,512}$/i.test(value)
    })
  } catch { return false }
}

export function tiktokTracker() {
  if (typeof window === 'undefined' || !isPublicTikTokUrl(window.location.href) || !isPublicTikTokUrl(document.referrer)) return null
  if (window.ttq) return window.ttq
  window.TiktokAnalyticsObject = 'ttq'
  const queue: TikTokQueue = []
  queue.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent']
  queue.setAndDefer = (target, method) => {
    Object.assign(target, { [method]: (...args: unknown[]) => target.push([method, ...args]) })
  }
  for (const method of queue.methods) queue.setAndDefer(queue, method)
  const url = 'https://analytics.tiktok.com/i18n/pixel/events.js'
  queue._i = { [TIKTOK_PIXEL_CODE]: Object.assign([], { _u: url }) }
  queue.instance = code => {
    const instance = queue._i?.[code] ?? []
    for (const method of queue.methods ?? []) queue.setAndDefer?.(instance, method)
    return instance
  }
  queue._t = { [TIKTOK_PIXEL_CODE]: Date.now() }
  // Automatic form/DOM collection is disabled in Events Manager. Only the
  // explicit page()/track() calls below are configured by this integration.
  queue._o = { [TIKTOK_PIXEL_CODE]: {} }
  window.ttq = queue
  return queue
}

export function trackTikTokCheckout(currency: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || !/^[A-Z]{3}$/.test(currency)) return
  tiktokTracker()?.track?.('InitiateCheckout', { currency, value })
}
