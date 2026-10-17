import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { PageShell } from '@/components/ui/PageShell'
import { POLICY_UPDATED } from '@/lib/policy-copy'
import type { PageContent } from '@/types'
import type { StoreSettings } from '@/lib/store-settings'

const T1 = '#1A1228', T2 = '#4A4060'

export function LegalPage({ page, settings }: { page: PageContent; settings: StoreSettings }) {
  const paragraphs = page.content.replace(/\\r\\n|\\n/g, '\n').replace(/\r\n?/g, '\n').replace(/^(أدوات القياس والإعلانات|قوقل|ميتا|خيارات القياس الحالية|سناب|التحكم بسناب|التخزين|طلبات الخصوصية): /gm, '## $1\n').replace(/^(## [^\n]+)\n/gm, '$1\n\n').split(/\n\n+/)
  return (
    <PageShell>
      <Navbar />
      <main style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 clamp(20px,6vw,40px)' }}>
          <h1 style={{ fontSize: 'clamp(24px,5.5vw,34px)', fontWeight: 900, marginBottom: 28, color: T1 }}>{page.title}</h1>
          <p style={{ fontSize: 13, color: T2, marginBottom: 28 }}>آخر تحديث: <time dateTime={POLICY_UPDATED}>١٧ أكتوبر ٢٠٢٦</time></p>
          {paragraphs.map((p, i) => (
            p.startsWith('## ') ? <h2 key={i} style={{ fontSize: 21, color: T1, marginTop: 30, marginBottom: 12 }}>{p.slice(3)}</h2> :
            <p key={i} style={{ fontSize: 15, color: T2, lineHeight: 1.9, marginBottom: 18 }}>{p}</p>
          ))}
          <p style={{ fontSize: 15, color: T2, lineHeight: 1.9, marginTop: 28 }}>
            للتواصل والدعم: {' '}
            <a href={`mailto:${settings.email}`} dir="ltr" style={{ display: 'inline-block', color: '#6747B2', textUnderlineOffset: 4 }}>
              {settings.email}
            </a>
          </p>
        </div>
      </main>
      <Footer settings={settings} />
    </PageShell>
  )
}
