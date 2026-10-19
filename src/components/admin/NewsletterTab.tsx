'use client'
import { useEffect, useState } from 'react'

export function NewsletterTab() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ email: string; confirmed_at: string }[]>([])
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setBusy(true); setError('')
      try {
        const response = await fetch(`/api/admin/newsletter?page=${page}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error('تعذّر تحميل القائمة.')
        setData(result.data ?? []); setTotal(result.total ?? 0)
      } catch { if (!controller.signal.aborted) setError('تعذّر تحميل القائمة. حدّثي الصفحة للمحاولة مرة ثانية.') }
      finally { if (!controller.signal.aborted) setBusy(false) }
    }
    load()
    return () => controller.abort()
  }, [page])
  return <section style={{ color: '#352D42', lineHeight: 1.9 }}>
    <h1 style={{ fontSize: 26 }}>القائمة البريدية</h1>
    <p>المشتركات المؤكّدات والفعّالات: <strong>{total}</strong></p>
    <p>تظهر هنا عناوين أكّدت الاشتراك فقط. إلغاء الاشتراك يستبعد العنوان من التصدير تلقائياً.</p>
    <a href="/api/admin/newsletter?export=csv" download="rwnak-newsletter.csv" className="newsletter-confirm-button" style={{ display: 'inline-block', textDecoration: 'none', margin: '18px 0' }}>تصدير CSV</a>
    <p style={{ fontSize: 14 }}>يتضمن الملف رابط إلغاء لكل مشتركة. ضيفي رابط الإلغاء الخاص بكل مستلمة عند تجهيز أي حملة، واستخدمي قائمة مصدّرة حديثاً.</p>
    {busy ? <p role="status">جاري التحميل…</p> : error ? <p role="alert">{error}</p> : data.length ? <div style={{ overflowX: 'auto', marginTop: 20 }}><table style={{ width: '100%', background: 'white', borderCollapse: 'collapse', textAlign: 'right' }}><thead><tr><th style={{ padding: 14 }}>البريد الإلكتروني</th><th style={{ padding: 14 }}>تاريخ التأكيد</th></tr></thead><tbody>{data.map(row => <tr key={row.email}><td style={{ padding: 14, borderTop: '1px solid #EDE8F5' }} dir="ltr">{row.email}</td><td style={{ padding: 14, borderTop: '1px solid #EDE8F5' }}>{new Date(row.confirmed_at).toLocaleDateString('ar-KW')}</td></tr>)}</tbody></table></div> : <p style={{ marginTop: 20 }}>ما عندنا مشتركات مؤكّدات للحين. نموذج الاشتراك موجود أسفل الموقع.</p>}
    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button className="newsletter-confirm-button" disabled={busy || page === 0} onClick={() => setPage(page - 1)}>السابق</button><button className="newsletter-confirm-button" disabled={busy || (page + 1) * 50 >= total} onClick={() => setPage(page + 1)}>التالي</button></div>
  </section>
}
