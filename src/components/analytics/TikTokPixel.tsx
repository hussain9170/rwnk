'use client'

import Script from 'next/script'
import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { TIKTOK_CONSENT_CHANGE } from '@/lib/tiktok-consent'
import { hasTikTokPixelConsent, isPublicTikTokUrl, TIKTOK_PIXEL_CODE, tiktokTracker } from '@/lib/tiktok-client'

function Pixel() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const [load, setLoad] = useState(false)
  const lastPage = useRef<string | null>(null)

  useEffect(() => {
    function unloadIfDisabled() {
      if (!hasTikTokPixelConsent() && window.ttq) window.location.reload()
    }
    function syncPreference(event: StorageEvent) {
      if (event.key === TIKTOK_CONSENT_CHANGE) unloadIfDisabled()
    }
    window.addEventListener('storage', syncPreference)
    window.addEventListener('pageshow', unloadIfDisabled)
    document.addEventListener('visibilitychange', unloadIfDisabled)
    return () => {
      window.removeEventListener('storage', syncPreference)
      window.removeEventListener('pageshow', unloadIfDisabled)
      document.removeEventListener('visibilitychange', unloadIfDisabled)
    }
  }, [])

  useEffect(() => {
    if (!hasTikTokPixelConsent() || pathname === '/privacy' || !isPublicTikTokUrl(window.location.href) || !isPublicTikTokUrl(document.referrer)) {
      // Removing a script does not unload its SDK. Restart on private routes.
      if (window.ttq) window.location.reload()
      lastPage.current = null
      return
    }
    let active = true
    const tracker = tiktokTracker()
    if (!tracker) return
    queueMicrotask(() => { if (active && hasTikTokPixelConsent()) setLoad(true) })
    const page = `${pathname}?${search}`
    if (lastPage.current !== page) {
      tracker.page?.()
      lastPage.current = page
    }
    return () => { active = false }
  }, [pathname, search])

  return load && pathname !== '/privacy' && hasTikTokPixelConsent() ? <Script id="rwnak-tiktok-pixel" src={`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${TIKTOK_PIXEL_CODE}&lib=ttq`} strategy="afterInteractive" /> : null
}

export default function TikTokPixel() {
  return <Suspense fallback={null}><Pixel /></Suspense>
}
