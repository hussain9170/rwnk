'use client'
import { useId, useState } from 'react'

export function NewsletterSignup() {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), consent: true, website: form.get('website') }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setSuccess(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذّر الاشتراك، حاولي لاحقاً.') }
    finally { setBusy(false) }
  }
  return <section className="newsletter-signup" aria-labelledby={`${id}-heading`}>
    <div><h2 id={`${id}-heading`}>خلّي نصائح رونق توصل لبريدج</h2><p>نصائح لتنظيم البيت وتدريب العاملة، وأخبار وعروض رونق.</p></div>
    {success ? <p role="status">راجعي بريدج لتفعيل الاشتراك. ممكن تلقين الرسالة في البريد غير المرغوب؛ إذا ما وصلت، جرّبي لاحقاً.</p> : <form onSubmit={submit}>
      <label htmlFor={`${id}-email`}>البريد الإلكتروني</label>
      <div className="newsletter-input-row"><input id={`${id}-email`} name="email" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" maxLength={254} required /><button disabled={busy} type="submit">{busy ? 'جاري الإرسال…' : 'اشتركي بالبريد'}</button></div>
      <div className="newsletter-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <a href="/privacy">سياسة الخصوصية</a>
      {error ? <p role="alert">{error}</p> : null}
    </form>}
  </section>
}
