'use client'

import { useEffect, useRef } from 'react'

export function GuideContents() {
  const details = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === '#content' && details.current) {
        details.current.open = true
        details.current.scrollIntoView({ block: 'start' })
      }
    }
    const onLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const link = event.target.closest<HTMLAnchorElement>('a[href]')
      if (link && link.pathname === window.location.pathname && link.hash === '#content' && details.current) details.current.open = true
    }
    reveal()
    window.addEventListener('hashchange', reveal)
    document.addEventListener('click', onLink)
    return () => {
      window.removeEventListener('hashchange', reveal)
      document.removeEventListener('click', onLink)
    }
  }, [])
  return <details id="content" ref={details} className="guide-contents">
    <summary>شنو يشمل الدليل؟</summary>
    <p>٦٦ مهمة بخطوات واضحة، غرفة بغرفة، ومعاها:</p>
    <ul><li>قوائم متابعة ومراجعة التنظيف.</li><li>جداول يومية وأسبوعية وشهرية.</li><li>نسخة PDF بلغة واحدة تختارينها، تقرينها على الجهاز أو تطبعينها.</li></ul>
    <a href="#preview-heading">شوفي مثال من طريقة الشرح ←</a>
  </details>
}
