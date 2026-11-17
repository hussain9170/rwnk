'use client'

import { useEffect, useState } from 'react'
import { allowsTikTokPixel, TIKTOK_CONSENT_CHANGE } from '@/lib/tiktok-consent'

export function TikTokPrivacySettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    function syncPreference(event: StorageEvent) {
      if (event.key !== TIKTOK_CONSENT_CHANGE) return
      setEnabled(allowsTikTokPixel(document.cookie))
      setMessage('')
    }
    window.addEventListener('storage', syncPreference)
    return () => window.removeEventListener('storage', syncPreference)
  }, [])

  async function save(next: boolean) {
    const browser = navigator as Navigator & { globalPrivacyControl?: boolean }
    if (next && browser.globalPrivacyControl) {
      setError('قياس تيك توك موقّف بإشارة الخصوصية في متصفحج.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/privacy/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!response.ok || allowsTikTokPixel(document.cookie) !== next) throw new Error('Consent could not be saved')
      setEnabled(next)
      setMessage(next ? 'تم تفعيل القياس.' : 'تم إيقاف القياس.')
      try { localStorage.setItem(TIKTOK_CONSENT_CHANGE, crypto.randomUUID()) } catch {}
      if (!next && window.ttq) window.location.reload()
    } catch {
      setError('تعذّر حفظ اختيارج. جرّبي مرة ثانية.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="privacy-settings" aria-labelledby="privacy-settings-title" style={{ scrollMarginTop: 115, padding: 20, marginBottom: 28, border: '1px solid #E7DFF7', borderRadius: 12 }}>
      <h2 id="privacy-settings-title" style={{ fontSize: 21, fontWeight: 800, marginBottom: 10 }}>إعدادات الخصوصية</h2>
      <p style={{ lineHeight: 1.9, marginBottom: 12 }}>
        قياس إعلانات تيك توك اختياري. إذا وافقتي، نشارك بيانات الزيارة ومعرّفات المتصفح وقيمة الشراء والبريد بعد تجزئته لقياس الإعلانات. تقدرين تشترين بدون الموافقة.
      </p>
      <p style={{ marginBottom: 12 }}>قياس إعلانات تيك توك {enabled ? 'مفعّل' : 'موقّف'}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button type="button" disabled={saving} className="rounded-lg border border-[#6747B2] px-4 py-2 font-bold text-[#573799] hover:bg-[#F4EFFF] disabled:opacity-50" onClick={() => void save(true)}>أوافق على القياس</button>
        <button type="button" disabled={saving} className="rounded-lg border border-[#6747B2] px-4 py-2 font-bold text-[#573799] hover:bg-[#F4EFFF] disabled:opacity-50" onClick={() => void save(false)}>عدم السماح بالقياس</button>
      </div>
      {message && <p role="status" style={{ marginTop: 10 }}>{message}</p>}
      {error && <p role="alert" style={{ marginTop: 10 }}>{error}</p>}
    </section>
  )
}
