import type { Metadata, Viewport } from 'next'
import { tajawal } from '@/lib/font'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import MetaPixel from '@/components/analytics/MetaPixel'
import SnapPixel from '@/components/analytics/SnapPixel'
import SnapConsent from '@/components/analytics/SnapConsent'
import './globals.css'
import { SITE_URL, SHARE_IMAGE } from '@/lib/seo'

const APP_URL = SITE_URL

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'رَوْنَق — دليل تدريب العاملة وتنظيم تنظيف المنزل',
    template: '%s | رَوْنَق',
  },
  description: 'دليل PDF لتدريب العاملة المنزلية وتنظيم التنظيف في الكويت والخليج، مع خطوات وقوائم متابعة وجداول قابلة للطباعة. اختاري لغة الدليل وحمّليه بعد الدفع.',
  keywords: ['تنظيف منزلي', 'تدريب عاملات', 'دليل تنظيف', 'تنظيف احترافي', 'رونق', 'الكويت'],
  authors: [{ name: 'رَوْنَق', url: APP_URL }],
  openGraph: {
    title: 'رَوْنَق — دليل التنظيف الاحترافي',
    description: 'دليل PDF لتدريب العاملة وتنظيم التنظيف المنزلي بخطوات وقوائم وجداول قابلة للطباعة.',
    url: APP_URL,
    siteName: 'رَوْنَق',
    locale: 'ar_KW',
    type: 'website',
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'رَوْنَق — دليل التنظيف الاحترافي',
    description: 'دليل PDF لتدريب العاملة وتنظيم التنظيف المنزلي.',
    images: [SHARE_IMAGE.url],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6747B2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body>
        <GoogleAnalytics />
        <MetaPixel />
        <SnapPixel />
        <SnapConsent />
        {children}
      </body>
    </html>
  )
}
