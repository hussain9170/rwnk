import CheckoutForm from './CheckoutForm'
import { getStoreSettings } from '@/lib/store-settings'
import { getBookLanguages } from '@/lib/content'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const [settings, available] = await Promise.all([getStoreSettings(), getBookLanguages()])
  const params = await searchParams
  const requested = typeof params.lang === 'string' ? params.lang : ''
  const initialLanguage = available.some(l => l.language_code === requested) ? requested : ''
  const languages = available
  return <CheckoutForm settings={settings} languages={languages} initialLanguage={initialLanguage} />
}
