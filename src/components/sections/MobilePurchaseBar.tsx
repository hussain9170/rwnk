'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { arabicNumber, supportWhatsapp } from '@/lib/display'

export function MobilePurchaseBar({ price, whatsapp }: { price: number; whatsapp: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const hero = document.getElementById('hero-buy')
    if (!hero || !('IntersectionObserver' in window)) return
    let passed = false
    const update = () => {
      const focused = document.activeElement?.tagName
      const typing = focused === 'INPUT' || focused === 'TEXTAREA' || focused === 'SELECT' || (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable)
      setVisible(passed && !typing && !document.querySelector('.guide-preview-dialog[open]') && document.body.style.overflow !== 'hidden')
    }
    const observer = new IntersectionObserver(([entry]) => { passed = !entry.isIntersecting && entry.boundingClientRect.bottom < 0; update() })
    const mutations = new MutationObserver(update)
    observer.observe(hero)
    mutations.observe(document.body, { attributes:true, attributeFilter:['style'], subtree:true })
    mutations.observe(document.documentElement, { attributes:true, attributeFilter:['open'], subtree:true })
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => { observer.disconnect(); mutations.disconnect(); document.removeEventListener('focusin', update); document.removeEventListener('focusout', update); window.visualViewport?.removeEventListener('resize', update) }
  }, [])
  const support = supportWhatsapp(whatsapp)
  if (!visible) return null
  return <aside className="mobile-purchase-bar" aria-label="شراء دليل رونق"><div><strong>{arabicNumber(price)} د.ك</strong><small>دفعة واحدة</small></div><Link href="/checkout" className="mobile-buy">اشتري الدليل</Link>{support && <a href={support} target="_blank" rel="noopener noreferrer" className="mobile-support" aria-label="واتساب للدعم">الدعم</a>}</aside>
}
