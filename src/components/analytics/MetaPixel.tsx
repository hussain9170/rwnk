'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ANALYTICS_QUERY_KEYS } from '@/lib/gtag'

const PIXEL_ID = '850585977987749'
type PixelQueue = ((...args: unknown[]) => void) & {
  queue: unknown[][]
  callMethod?: (...args: unknown[]) => void
  push?: PixelQueue
  loaded: boolean
  version: string
  disablePushState: boolean
}

declare global {
  interface Window { fbq?: PixelQueue; _fbq?: PixelQueue }
}

// Meta reads the actual URL. Do not load or send hits on account/recovery
// pages or URLs containing anything except public campaign parameters.
function isPublicPixelUrl(raw: string) {
  if (!raw) return true
  const url = new URL(raw, window.location.origin)
  if (/^\/(newsletter|auth|login|register|reset-password|account|library|admin|success|api)(\/|$)/.test(url.pathname)) return false
  if (url.hash) return false
  return Array.from(url.searchParams.keys()).every(key => ANALYTICS_QUERY_KEYS.includes(key))
}

export default function MetaPixel() {
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
    if (!window.fbq) {
      const queue: PixelQueue = Object.assign(function (...args: unknown[]) {
        if (queue.callMethod) queue.callMethod(...args)
        else queue.queue.push(args)
      }, { queue: [] as unknown[][], loaded: true, version: '2.0', disablePushState: true })
      queue.push = queue
      window.fbq = queue
      window._fbq = queue
    }
    if (!initialized.current) {
      window.fbq.disablePushState = true
      window.fbq('set', 'autoConfig', false, PIXEL_ID)
      window.fbq('init', PIXEL_ID)
      initialized.current = true
    }
    queueMicrotask(() => setLoad(true))
    if (ready && lastPage.current !== pathname) {
      window.fbq('trackSingle', PIXEL_ID, 'PageView')
      lastPage.current = pathname
    }
  }, [pathname, ready])

  return load ? <Script id="rwnak-meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" onReady={() => setReady(true)} /> : null
}
