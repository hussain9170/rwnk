import type { Metadata } from 'next'
import { getPage, pageMetadata } from '@/lib/content'
import { getStoreSettings } from '@/lib/store-settings'
import { LegalPage } from '@/components/sections/LegalPage'

// Public HTML is refreshed by admin invalidation and bounded ISR.
export const dynamic = 'force-static'
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(await getPage('refund', { strict: true }))
}

export default async function RefundPage() {
  const [page, settings] = await Promise.all([getPage('refund', { strict: true }), getStoreSettings({ strict: true })])
  return <LegalPage page={page} settings={settings} />
}
