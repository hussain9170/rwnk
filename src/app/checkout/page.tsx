import CheckoutForm from './CheckoutForm'
import { getStoreSettings } from '@/lib/store-settings'
import { getBookLanguages } from '@/lib/content'

export const revalidate = 60

export default async function CheckoutPage() {
  const [settings, available] = await Promise.all([getStoreSettings(), getBookLanguages()])
  const languages = available
  return <CheckoutForm settings={settings} languages={languages} />
}
