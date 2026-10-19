'use client'
import { useState } from 'react'

export function NewsletterConfirm({ token, unsubscribe = false }: { token: string; unsubscribe?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (busy || done) return
    setBusy(true); setError('')
    try {
      const response = await fetch(unsubscribe ? '/api/newsletter/unsubscribe' : '/api/newsletter/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setDone(true)
      window.history.replaceState(null, '', unsubscribe ? '/newsletter/unsubscribe' : '/newsletter/confirm')
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذّر التأكيد.') }
    finally { setBusy(false) }
  }
  return <div>
    <h1>{unsubscribe ? (done ? 'تم إلغاء الاشتراك' : 'إلغاء الاشتراك ببريد رونق') : (done ? 'تم تفعيل اشتراكج' : 'تأكيد الاشتراك ببريد رونق')}</h1>
    <p>{unsubscribe ? 'إلغاء الاشتراك يوقف الرسائل التسويقية، وتستمر رسائل الطلبات والحساب.' : done ? 'بتوصلج نصائح تنظيم البيت وأخبار وعروض رونق. تقدرين تلغين الاشتراك من رابط الإلغاء في الرسائل.' : 'اضغطي الزر لتفعيل الاشتراك بنصائح تنظيم المنزل وأخبار وعروض رونق.'}</p>
    {!done ? <button className="newsletter-confirm-button" onClick={confirm} disabled={busy || !token}>{busy ? 'جاري الحفظ…' : unsubscribe ? 'إلغاء الاشتراك' : 'تأكيد الاشتراك'}</button> : null}
    {!token && !done ? <p>افتحي رابط التفعيل الموجود في بريدج. إذا انتهت صلاحيته، اشتركي مرة ثانية من الموقع.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>
}
