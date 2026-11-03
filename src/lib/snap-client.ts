import { ANALYTICS_QUERY_KEYS } from '@/lib/gtag'
import { hasSnapConsent } from '@/lib/snap-consent'

const PIXEL_ID = '92c5f03d-414c-48be-9bf2-12bbb0fbdbf4'
type SnapQueue = ((...args: unknown[]) => void) & {
  queue: unknown[][]
  rwnakInitialized?: boolean
  handleRequest?: (...args: unknown[]) => void
}

declare global {
  interface Window { snaptr?: SnapQueue }
}

// The SDK reads the actual browser URL and referrer. Avoid loading or
// explicitly tracking account/recovery pages and URLs with private parameters.
export function isPublicPixelUrl(raw: string) {
  if (!raw) return true
  const url = new URL(raw, window.location.origin)
  if (/^\/(newsletter|auth|login|register|reset-password|account|library|admin|success|api)(\/|$)/.test(url.pathname)) return false
  if (url.hash) return false
  return Array.from(url.searchParams.keys()).every(key => {
    if (ANALYTICS_QUERY_KEYS.includes(key)) return true
    if (key === 'lang') return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(url.searchParams.get(key) ?? '')
    // These UUID parameters are issued by Snap's click attribution/test tools.
    return ['ScCid', 'ScTestModeId'].includes(key) && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(url.searchParams.get(key) ?? '')
  })
}

// Queue before the SDK finishes downloading so a fast checkout is not lost.
export function snapTracker() {
  if (typeof window === 'undefined' || !hasSnapConsent() || !isPublicPixelUrl(window.location.href) || !isPublicPixelUrl(document.referrer)) return null
  if (!window.snaptr) {
    const queue: SnapQueue = Object.assign(function (...args: unknown[]) {
      if (queue.handleRequest) queue.handleRequest(...args)
      else queue.queue.push(args)
    }, { queue: [] as unknown[][] })
    window.snaptr = queue
  }
  const tracker = window.snaptr
  if (!tracker.rwnakInitialized) {
    tracker('init', PIXEL_ID)
    tracker.rwnakInitialized = true
  }
  return tracker
}

export function trackSnapCheckout(currency: string, price: number) {
  snapTracker()?.('track', 'START_CHECKOUT', { currency, price })
}
