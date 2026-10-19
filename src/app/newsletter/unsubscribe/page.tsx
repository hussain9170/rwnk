import type { Metadata } from 'next'
import Link from 'next/link'
import { NewsletterConfirm } from '@/components/ui/NewsletterConfirm'

export const metadata: Metadata = { title: 'إلغاء الاشتراك', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams
  const token = typeof params.token === 'string' && params.token.length < 150 ? params.token : ''
  return <main className="newsletter-confirm-page" dir="rtl"><NewsletterConfirm token={token} unsubscribe /><Link href="/">العودة لرونق</Link></main>
}
