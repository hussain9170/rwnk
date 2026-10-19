import type { Metadata } from 'next'
import Link from 'next/link'
import { NewsletterConfirm } from '@/components/ui/NewsletterConfirm'

export const metadata: Metadata = { title: 'تأكيد الاشتراك', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export const dynamic = 'force-dynamic'
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams
  const token = typeof params.token === 'string' && /^[a-f0-9]{64}$/.test(params.token) ? params.token : ''
  return <main className="newsletter-confirm-page" dir="rtl"><NewsletterConfirm token={token} /><Link href="/">العودة لرونق</Link></main>
}
