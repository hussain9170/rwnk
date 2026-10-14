'use client'

// Track App Router page views manually. In the GA4 web stream, disable
// Enhanced Measurement's history-change page views to prevent duplicates:
// send_page_view:false only suppresses the initial automatic config event.
import Script from 'next/script'
import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { GA_MEASUREMENT_ID, ANALYTICS_QUERY_KEYS, pageview } from '@/lib/gtag'

// useSearchParams() opts any component that calls it into client-side
// rendering unless wrapped in its own Suspense boundary — isolated here so
// it can never affect how the rest of the app (or this component's Script
// tags) render.
function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPage = useRef<string | null>(null)

  useEffect(() => {
    const query = searchParams.toString()
    const url = query ? `${pathname}?${query}` : pathname
    if (lastPage.current === url) return
    lastPage.current = url
    pageview(url)
  }, [pathname, searchParams])

  return null
}

export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      {/* beforeInteractive (not afterInteractive) is deliberate: this defines
          window.gtag as a synchronous queuing shim — the same pattern
          Google's own GA4 snippet uses — BEFORE hydration, so it exists no
          matter how fast a page's own effects fire (e.g. /success calling
          trackPurchase the instant its API response resolves). Every
          gtag(...) call just pushes onto dataLayer; the external gtag.js
          script below drains that queue once it finishes loading. Without
          this, an event fired before the (async, afterInteractive) library
          script finishes loading would silently no-op instead of queuing —
          confirmed by testing: /success's purchase event was dropped this
          way when both scripts used afterInteractive. */}
      <Script id="ga4-init" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          function safeAnalyticsUrl(raw) {
            if (!raw) return '';
            var url = new URL(raw, window.location.origin);
            var query = new URLSearchParams();
            ${JSON.stringify(ANALYTICS_QUERY_KEYS)}.forEach(function(key) {
              var value = url.searchParams.get(key);
              if (value) query.set(key, value);
            });
            url.search = query.toString();
            url.hash = '';
            return url.toString();
          }
          gtag('set', { page_location: safeAnalyticsUrl(window.location.href), page_referrer: safeAnalyticsUrl(document.referrer) });
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  )
}
