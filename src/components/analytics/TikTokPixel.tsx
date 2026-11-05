'use client'

import Script from 'next/script'
import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { isPublicTikTokUrl, TIKTOK_PIXEL_CODE, tiktokTracker } from '@/lib/tiktok-client'

function Pixel() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const [load, setLoad] = useState(false)
  const lastPage = useRef<string | null>(null)

  useEffect(() => {
    if (!isPublicTikTokUrl(window.location.href) || !isPublicTikTokUrl(document.referrer)) {
      // Removing a script does not unload its SDK. Restart on private routes.
      if (window.ttq) window.location.reload()
      lastPage.current = null
      return
    }
    const tracker = tiktokTracker()
    if (!tracker) return
    queueMicrotask(() => setLoad(true))
    const page = `${pathname}?${search}`
    if (lastPage.current !== page) {
      tracker.page?.()
      if (pathname === '/checkout') tracker.track?.('ViewContent', { content_type: 'product', content_name: 'دليل رونق لتدريب العاملة وتنظيم البيت' })
      lastPage.current = page
    }
  }, [pathname, search])

  return load ? <Script id="rwnak-tiktok-pixel" src={`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${TIKTOK_PIXEL_CODE}&lib=ttq`} strategy="afterInteractive" /> : null
}

export default function TikTokPixel() {
  return <Suspense fallback={null}><Pixel /></Suspense>
}
