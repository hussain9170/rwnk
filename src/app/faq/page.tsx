import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { PageShell } from '@/components/ui/PageShell'
import { getFaqs, getBookLanguages } from '@/lib/content'
import { getStoreSettings } from '@/lib/store-settings'
import { publicMetadata, breadcrumbs, jsonLd } from '@/lib/seo'

import { ProductFacts } from '@/components/sections/ProductFacts'
import { arabicNumber } from '@/lib/display'

const P = '#6747B2', T1 = '#1A1228', T2 = '#4A4060'

// Force per-request rendering so admin edits to FAQs/store settings are
// never stuck behind a stale build-time snapshot — see the detailed
// comment on this same export in src/app/page.tsx.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = publicMetadata('أسئلة عن دليل تدريب العاملة والتحميل واللغات', 'إجابات عن شراء دليل رونق الرقمي: اختيار لغة واحدة، استلام ملف PDF بعد الدفع، الطباعة وتحديثات الدليل.', '/faq')

export default async function FaqPage() {
  const [faqs, settings, languages] = await Promise.all([getFaqs(), getStoreSettings(), getBookLanguages()])
  return (
    <PageShell bg="#FAFAFA">
      <Navbar />
      <main style={{ paddingTop: 120, paddingBottom: 80 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs([{ name: 'الرئيسية', path: '/' }, { name: 'الأسئلة الشائعة', path: '/faq' }])) }} />
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(20px,6vw,40px)' }}>
          <h1 style={{ fontSize: 'clamp(24px,5.5vw,34px)', fontWeight: 900, marginBottom: 8, color: T1 }}>الأسئلة الشائعة</h1>
          <p style={{ fontSize: 15, color: T2, marginBottom: 32 }}>كل ما تحتاجين معرفته عن دليل رونق لتدريب العاملة وتنظيم البيت قبل الشراء.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
            <ProductFacts settings={settings} languages={languages} faqs={faqs} compact />
          </div>
          <div style={{ marginTop: 32 }}>
            <Link href="/checkout" style={{ background: P, color: '#fff', display: 'inline-block', fontSize: 15, fontWeight: 900, padding: '14px 28px', borderRadius: 12, textDecoration: 'none' }}>
              اشتري الدليل — {arabicNumber(settings.product_price)} د.ك
            </Link>
          </div>
        </div>
      </main>
      <Footer settings={settings} />
    </PageShell>
  )
}
