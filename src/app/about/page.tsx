import type { Metadata } from 'next'
import { getPage, pageMetadata } from '@/lib/content'
import { getStoreSettings } from '@/lib/store-settings'
import { LegalPage } from '@/components/sections/LegalPage'

// Public HTML is refreshed by admin invalidation and bounded ISR.
export const dynamic = 'force-static'
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(await getPage('about', { strict: true }))
}

export default async function AboutPage() {
  const [page, settings] = await Promise.all([getPage('about', { strict: true }), getStoreSettings({ strict: true })])
  return <LegalPage page={page} settings={settings} />
}
