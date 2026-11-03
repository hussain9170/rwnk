'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { isPublicPixelUrl, snapTracker } from '@/lib/snap-client'
import { hasSnapConsent, subscribeSnapConsent } from '@/lib/snap-consent'
import { useSyncExternalStore } from 'react'

export default function SnapPixel() {
  const pathname = usePathname()
  const consent = useSyncExternalStore(subscribeSnapConsent, hasSnapConsent, () => false)
  const publicLocation = useSyncExternalStore(subscribeSnapConsent, () => isPublicPixelUrl(window.location.href) && isPublicPixelUrl(document.referrer), () => false)
  const load = consent && publicLocation
  const initialized = useRef(false)
  const lastPage = useRef<string | null>(null)

  useEffect(() => {
    if (!consent || !isPublicPixelUrl(window.location.href) || !isPublicPixelUrl(document.referrer)) {
      // Stop the previously loaded SDK when entering private account routes.
      if (initialized.current) window.location.reload()
      lastPage.current = null
      return
    }
    const tracker = snapTracker()
    if (!tracker) return
    initialized.current = true
    const click = new URL(window.location.href).searchParams.get('ScCid')
    if (click && /^[0-9a-f-]{36}$/i.test(click)) document.cookie = `rwnak_snap_click=${click}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
    if (lastPage.current !== pathname) {
      tracker('track', 'PAGE_VIEW')
      if (pathname === '/checkout') tracker('track', 'VIEW_CONTENT')
      lastPage.current = pathname
    }
  }, [pathname, consent])

  return load ? <Script id="rwnak-snap-pixel" src="https://sc-static.net/scevent.min.js" strategy="afterInteractive" /> : null
}
