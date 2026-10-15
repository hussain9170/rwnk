'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ANALYTICS_QUERY_KEYS } from '@/lib/gtag'

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
  return Array.from(url.searchParams.keys()).every(key => ANALYTICS_QUERY_KEYS.includes(key) || key === 'ScCid')
}

export default function SnapPixel() {
  const pathname = usePathname()
  const [load, setLoad] = useState(false)
  const [ready, setReady] = useState(false)
  const initialized = useRef(false)
  const lastPage = useRef<string | null>(null)

  useEffect(() => {
    if (!isPublicPixelUrl(window.location.href) || !isPublicPixelUrl(document.referrer)) {
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
    setLoad(true)
    if (!ready) return
    if (!initialized.current) {
      // No email, phone number or customer identity is passed to the SDK.
      window.snaptr('init', PIXEL_ID)
      initialized.current = true
    }
    if (lastPage.current !== pathname) {
      window.snaptr('track', 'PAGE_VIEW')
      lastPage.current = pathname
    }
  }, [pathname, ready])

  return load ? <Script id="rwnak-snap-pixel" src="https://sc-static.net/scevent.min.js" strategy="afterInteractive" onReady={() => setReady(true)} /> : null
}
