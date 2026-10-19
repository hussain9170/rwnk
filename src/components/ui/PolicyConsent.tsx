'use client'

import { useId } from 'react'

export function PolicyConsent({ checked, onChange, purchase = false }: { checked: boolean; onChange: (value: boolean) => void; purchase?: boolean }) {
  const id = useId()
  return <div className="policy-consent">
    <input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} required />
    <label htmlFor={id}>أوافق على <a href="/terms" target="_blank" rel="noopener noreferrer">شروط الاستخدام</a>{purchase ? <> و<a href="/refund" target="_blank" rel="noopener noreferrer">سياسة الاسترجاع</a></> : null}، واطّلعت على <a href="/privacy" target="_blank" rel="noopener noreferrer">سياسة الخصوصية</a>.</label>
  </div>
}
