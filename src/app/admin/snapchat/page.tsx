'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Status = { configured: boolean; connected: boolean; verified?: boolean; error?: string; accounts?: { id: string; name: string; currency: string; status: string }[] }

export default function SnapchatConnectionPage() {
  return <Suspense fallback={<p dir="rtl">جاري تحميل حالة الربط…</p>}><SnapchatConnection /></Suspense>
}

function SnapchatConnection() {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const result = useSearchParams().get('result')
  const messages: Record<string, string> = {
    connected: 'تم حفظ تفويض سناب بنجاح.',
    invalid_state: 'تعذر التحقق من طلب التفويض. ابدأ الربط مجدداً من هذه الصفحة.',
    expired_state: 'طلب التفويض انتهى أو استُخدم سابقاً. ابدأ الربط مجدداً.',
    denied: 'لم يكتمل تفويض سناب.',
    connection_failed: 'تعذر إكمال الربط. تأكد من صلاحية حسابك في مؤسسة رونق ثم حاول مجدداً.',
  }
  const resultMessage = result ? messages[result] : ''
  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setConnecting(true)
    setError('')
    try {
      const response = await fetch('/api/admin/integrations/snapchat/connect', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'تعذر بدء تفويض سناب')
      const destination = new URL(data.authorizeUrl)
      if (destination.origin !== 'https://accounts.snapchat.com' || destination.pathname !== '/login/oauth2/authorize') throw new Error('عنوان تفويض غير صالح')
      window.location.assign(destination.toString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر بدء تفويض سناب')
      setConnecting(false)
    }
  }
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/integrations/snapchat', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(response.status === 403 ? 'هذه الصفحة للمدير الرئيسي فقط' : 'تعذر تحميل حالة الربط')
      const data = await response.json()
      if (!cancelled) setStatus(data)
    }).catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])
  return <main dir="rtl" className="min-h-screen bg-gray-50 p-6 text-gray-900">
    <div className="mx-auto max-w-3xl space-y-6 rounded-2xl bg-white p-6 shadow-sm">
      <Link href="/admin" className="text-purple-700">العودة للوحة التحكم</Link>
      <h1 className="text-2xl font-bold">ربط إعلانات سناب</h1>
      <p>اربط حساب الأعمال لقراءة حسابات الإعلان والتحقق من الاتصال.</p>
      {resultMessage && <p role="status">{resultMessage}</p>}
      {error ? <p role="alert">{error}</p> : !status ? <p>جاري فحص الاتصال…</p> : <>
        <p role="status">{status.verified ? 'الاتصال شغال وتم التحقق من الحسابات ✅' : status.connected ? 'التفويض محفوظ، والتحقق من الاتصال يحتاج مراجعة' : status.configured ? 'جاهز للتفويض' : 'إعداد الاتصال على السيرفر غير مكتمل'}</p>
        {status.error && <p role="alert">{status.error}</p>}
        {status.configured && <form onSubmit={connect}>
          <button type="submit" disabled={connecting} className="rounded-xl bg-purple-800 px-6 py-3 text-white">{connecting ? 'جاري الانتقال لسناب…' : status.connected ? 'إعادة تفويض سناب' : 'ربط حساب سناب'}</button>
        </form>}
        {!!status.accounts?.length && <div className="overflow-x-auto"><table className="w-full text-right">
          <thead><tr><th className="p-3">الحساب الإعلاني</th><th className="p-3">العملة</th><th className="p-3">الحالة</th></tr></thead>
          <tbody>{status.accounts.map(account => <tr key={account.id}><td className="p-3">{account.name}</td><td className="p-3">{account.currency}</td><td className="p-3">{account.status}</td></tr>)}</tbody>
        </table></div>}
      </>}
    </div>
  </main>
}
