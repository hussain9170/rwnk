'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { META_PIXEL_ID, metaTracker } from '@/lib/meta-client'

export default function MetaPixel() {
  const pathname = usePathname()
  const [load, setLoad] = useState(false)
  const [ready, setReady] = useState(false)
  const lastPage = useRef<string | null>(null)

  useEffect(() => {
    const tracker = metaTracker()
    if (!tracker) { lastPage.current = null; return }
    queueMicrotask(() => setLoad(true))
    if (ready && lastPage.current !== pathname) {
      tracker('trackSingle', META_PIXEL_ID, 'PageView')
      lastPage.current = pathname
    }
  }, [pathname, ready])

  return load ? <Script id="rwnak-meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" onReady={() => setReady(true)} /> : null
}
