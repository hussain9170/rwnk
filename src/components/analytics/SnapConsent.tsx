'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { SNAP_CONSENT_COOKIE, SNAP_CONSENT_EVENT, SNAP_CONSENT_VERSION, parseSnapConsent, snapConsentValue, subscribeSnapConsent } from '@/lib/snap-consent'

export default function SnapConsent() {
  const value = useSyncExternalStore(subscribeSnapConsent, snapConsentValue, () => '')
  const [editing, setEditing] = useState(false)
  const pathname = usePathname()
  const consent = parseSnapConsent(value)
  if (/^\/(admin|auth|login|register|reset-password|account|library|success)(\/|$)/.test(pathname)) return null

  async function choose(granted: boolean) {
    // Revoke unsent server events belonging to the previous consent receipt.
    if (!granted && consent?.granted) {
      await fetch('/api/snap-consent', { method: 'DELETE', keepalive: true }).catch(() => {})
    }
    document.cookie = `${SNAP_CONSENT_COOKIE}=${SNAP_CONSENT_VERSION}.${granted ? 'yes' : 'no'}.${crypto.randomUUID()}.${Date.now()}; Path=/; Max-Age=15552000; SameSite=Lax; Secure`
    if (!granted) {
      for (const name of ['_scid', '_scid_r', 'rwnak_snap_click']) {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`
        document.cookie = `${name}=; Domain=.rwnak.net; Path=/; Max-Age=0; SameSite=Lax; Secure`
      }
    }
    setEditing(false)
    window.dispatchEvent(new Event(SNAP_CONSENT_EVENT))
    // Removing a script element doesn't stop an already-running SDK.
    if (!granted && window.snaptr) window.location.reload()
  }

  if (consent && !editing) return <button type="button" onClick={() => setEditing(true)} style={{ position: 'fixed', bottom: 10, left: 10, zIndex: 90, background: '#fff', color: '#6747B2', border: '1px solid #DDD3EF', borderRadius: 12, padding: '8px 12px', fontFamily: 'inherit', fontSize: 12 }}>خصوصية سناب</button>

  return <aside aria-label="خصوصية إعلانات سناب" style={{ position: 'fixed', bottom: 16, left: 16, right: 16, maxWidth: 590, marginInline: 'auto', zIndex: 100, background: '#fff', color: '#1A1228', border: '1px solid #DDD3EF', borderRadius: 18, padding: 20, boxShadow: '0 8px 40px #1a122826', fontFamily: 'inherit', lineHeight: 1.8 }}>
    <strong>تسمحين بقياس إعلانات سناب؟</strong>
    <p style={{ fontSize: 14, marginBlock: 8 }}>بموافقتج نشارك مع سناب نشاط الزيارة والشراء وقيمته، ومعرّفات المتصفح والإعلان، ونستخدم بريدج الإلكتروني عند الشراء بصيغة مُجزّأة للمطابقة وتحسين الإعلانات. التجزئة ما تعني إن البيانات مجهولة تماماً. تقدرين ترفضين أو تغيّرين اختيارج بأي وقت، والشراء متاح بالحالتين. هالاختيار يخص سناب فقط؛ قوقل وميتا يشتغلون تلقائياً حسب التفصيل بسياسة الخصوصية. <Link href="/privacy" style={{ color: '#6747B2' }}>سياسة الخصوصية</Link></p>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => void choose(true)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #6747B2', background: '#6747B2', color: '#fff', fontFamily: 'inherit' }}>أوافق</button>
      <button type="button" onClick={() => void choose(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #6747B2', background: '#fff', color: '#6747B2', fontFamily: 'inherit' }}>أرفض</button>
    </div>
  </aside>
}
