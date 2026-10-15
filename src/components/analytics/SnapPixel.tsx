'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ANALYTICS_QUERY_KEYS } from '@/lib/gtag'
import { hasSnapConsent, subscribeSnapConsent } from '@/lib/snap-consent'
import { useSyncExternalStore } from 'react'

const PIXEL_ID = '92c5f03d-414c-48be-9bf2-12bbb0fbdbf4'
type SnapQueue = ((...args: unknown[]) => void) & {
  queue: unknown[][]
  handleRequest?: (...args: unknown[]) => void
}

declare global {
  interface Window { snaptr?: SnapQueue }
}

// The SDK reads the actual browser URL and referrer. Avoid loading or
// explicitly tracking account/recovery pages and URLs with private parameters.
function isPublicPixelUrl(raw: string) {
  if (!raw) return true
  const url = new URL(raw, window.location.origin)
  if (/^\/(auth|login|register|reset-password|account|library|admin|success|api)(\/|$)/.test(url.pathname)) return false
  if (url.hash) return false
  return Array.from(url.searchParams.keys()).every(key => {
    if (ANALYTICS_QUERY_KEYS.includes(key)) return true
    // These UUID parameters are issued by Snap's click attribution/test tools.
    return ['ScCid', 'ScTestModeId'].includes(key) && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(url.searchParams.get(key) ?? '')
  })
}

export default function SnapPixel() {
  const pathname = usePathname()
  const consent = useSyncExternalStore(subscribeSnapConsent, hasSnapConsent, () => false)
  const publicLocation = useSyncExternalStore(subscribeSnapConsent, () => isPublicPixelUrl(window.location.href) && isPublicPixelUrl(document.referrer), () => false)
  const load = consent && publicLocation
  const [ready, setReady] = useState(false)
  const initialized = useRef(false)
  const lastPage = useRef<string | null>(null)

  useEffect(() => {
    if (!consent || !isPublicPixelUrl(window.location.href) || !isPublicPixelUrl(document.referrer)) {
      // Stop the previously loaded SDK when entering private account routes.
      if (initialized.current) window.location.reload()
      lastPage.current = null
      return
    }
    if (!window.snaptr) {
      const queue: SnapQueue = Object.assign(function (...args: unknown[]) {
        if (queue.handleRequest) queue.handleRequest(...args)
        else queue.queue.push(args)
      }, { queue: [] as unknown[][] })
      window.snaptr = queue
    }
    const click = new URL(window.location.href).searchParams.get('ScCid')
    if (click && /^[0-9a-f-]{36}$/i.test(click)) document.cookie = `rwnak_snap_click=${click}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
    if (!ready) return
    if (!initialized.current) {
      // No email, phone number or customer identity is passed to the SDK.
      window.snaptr('init', PIXEL_ID)
      initialized.current = true
    }
    if (lastPage.current !== pathname) {
      window.snaptr('track', 'PAGE_VIEW')
      if (pathname === '/checkout') window.snaptr('track', 'VIEW_CONTENT')
      lastPage.current = pathname
    }
  }, [pathname, ready, consent])

  return load ? <Script id="rwnak-snap-pixel" src="https://sc-static.net/scevent.min.js" strategy="afterInteractive" onReady={() => setReady(true)} /> : null
}
