// Browser-only Meta events. Never pass receipt URLs, email or access tokens.
export const META_PIXEL_ID = '850585977987749'
const PUBLIC_PATH = /^\/(?:$|checkout\/?$|about\/?$|privacy\/?$|terms\/?$|refund\/?$|faq\/?$|blog(?:\/[a-z0-9-]+)?\/?$)/
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'gclid', 'dclid', 'gbraid', 'wbraid', 'fbclid']

export type MetaQueue = ((...args: unknown[]) => void) & {
  queue: unknown[][]; callMethod?: (...args: unknown[]) => void; push?: MetaQueue
  loaded: boolean; version: string; disablePushState: boolean; rwnakInitialized?: boolean
}
declare global { interface Window { fbq?: MetaQueue; _fbq?: MetaQueue } }

export function isPublicMetaUrl(raw: string, origin = 'https://www.rwnak.net') {
  if (!raw) return true
  try {
    const url = new URL(raw, origin)
    if (!PUBLIC_PATH.test(decodeURIComponent(url.pathname)) || url.hash) return false
    return [...url.searchParams].every(([key, value]) => key === 'lang'
      ? /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(value)
      : CAMPAIGN_KEYS.includes(key) && /^[a-z0-9_.,~+%:/ -]{0,512}$/i.test(value))
  } catch { return false }
}

function privacySignal() {
  return (window.navigator as Navigator & { globalPrivacyControl?: boolean })?.globalPrivacyControl === true
}

export function metaTracker() {
  if (typeof window === 'undefined' || privacySignal() || !isPublicMetaUrl(window.location.href) || !isPublicMetaUrl(document.referrer)) return null
  if (!window.fbq) {
    const queue: MetaQueue = Object.assign(function (...args: unknown[]) {
      if (queue.callMethod) queue.callMethod(...args)
      else queue.queue.push(args)
    }, { queue: [] as unknown[][], loaded: true, version: '2.0', disablePushState: true })
    queue.push = queue
    window.fbq = window._fbq = queue
  }
  if (!window.fbq.rwnakInitialized) {
    window.fbq.disablePushState = true
    window.fbq('set', 'autoConfig', false, META_PIXEL_ID)
    window.fbq('init', META_PIXEL_ID)
    window.fbq.rwnakInitialized = true
  }
  return window.fbq
}

function productProperties(currency: string, value: number, productId: string) {
  if (!Number.isFinite(value) || value < 0 || !/^[A-Z]{3}$/.test(currency) || !/^[a-z0-9_-]{1,128}$/i.test(productId)) return null
  return { currency, value, content_ids: [productId], content_type: 'product', num_items: 1,
    contents: [{ id: productId, quantity: 1, item_price: value }] }
}

export function trackMetaViewContent(currency: string, value: number, productId: string) {
  const properties = productProperties(currency, value, productId)
  if (properties) metaTracker()?.('trackSingle', META_PIXEL_ID, 'ViewContent', properties)
}

export function trackMetaCheckout(currency: string, value: number, productId: string) {
  const properties = productProperties(currency, value, productId)
  const tracker = properties && metaTracker()
  if (!tracker) return
  // Carry only a timestamp through the same-tab payment redirect. Without a
  // new checkout, opening a historical receipt must not create a fresh sale.
  try { window.sessionStorage.setItem('rwnak_meta_checkout_started', String(Date.now())) } catch { /* measurement only */ }
  tracker('trackSingle', META_PIXEL_ID, 'InitiateCheckout', properties)
}

// Keep a separate guard from GA4: a GA event is not a Meta delivery.
const inFlight = new Set<string>()
const dispatched = new Set<string>()
export function trackMetaPurchase(purchase: { status: string; tracking_id: string; amount: number; currency: string; product_id: string; created_at: string }) {
  if (typeof window === 'undefined' || privacySignal() || purchase.status !== 'completed') return
  let started: number
  try { started = Number(window.sessionStorage.getItem('rwnak_meta_checkout_started')) } catch { return }
  const created = Date.parse(purchase.created_at)
  const now = Date.now()
  if (!Number.isFinite(started) || started <= 0 || started > now || now - started > 86400000 || !Number.isFinite(created) || created < started - 60000 || created > now) return
  const properties = productProperties(purchase.currency, purchase.amount, purchase.product_id)
  if (!properties || !/^[a-z0-9_-]{1,128}$/i.test(purchase.tracking_id)) return
  const eventId = `rwnak_purchase_${purchase.tracking_id}`
  const key = `meta_purchase_dispatched_${eventId}`
  try { if (window.localStorage.getItem(key) === '1') return } catch { /* storage may be blocked */ }
  if (inFlight.has(eventId) || dispatched.has(eventId)) return
  inFlight.add(eventId)

  // The Pixel SDK must not execute in /success: its URL holds credentials.
  // An opaque-origin sandbox prevents it from reading the parent DOM/URL.
  const frame = document.createElement('iframe')
  frame.hidden = true
  frame.title = 'Meta purchase measurement'
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.referrerPolicy = 'no-referrer'
  frame.src = '/meta-purchase-frame.html'
  let timer: ReturnType<typeof setTimeout>
  function cleanup() {
    window.removeEventListener('message', onMessage)
    clearTimeout(timer)
    inFlight.delete(eventId)
    frame.remove()
  }
  function onMessage(event: MessageEvent) {
    if (event.source !== frame.contentWindow || event.origin !== 'null') return
    if (event.data?.type === 'rwnak-meta-ready') {
      // Opaque sandbox origins require '*'; the receiver checks parent source
      // and origin. Only an allowlisted commerce payload crosses the boundary.
      frame.contentWindow?.postMessage({ type: 'rwnak-meta-purchase', eventId, properties }, '*')
    } else if (event.data?.type === 'rwnak-meta-dispatched' && event.data.eventId === eventId) {
      dispatched.add(eventId)
      try { window.localStorage.setItem(key, '1') } catch { /* in-memory guard remains */ }
      // Dispatched means handed to the SDK, NOT confirmed delivery by Meta.
      clearTimeout(timer)
      timer = setTimeout(cleanup, 15000)
    }
  }
  window.addEventListener('message', onMessage)
  timer = setTimeout(cleanup, 30000)
  try { document.body.appendChild(frame) } catch { cleanup() }
}
