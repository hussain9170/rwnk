import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

// A purchase UUID is an identifier, never proof of ownership. Guest links
// are bound to that purchase and expire; account access requires a session.
export function createPurchaseAccess(purchaseId: string, now = Date.now()): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Purchase access is not configured')
  const expiry = Math.floor(now / 1000) + 30 * 24 * 60 * 60
  const signature = createHmac('sha256', key).update(`rwnak-access-v1:${purchaseId}:${expiry}`).digest('base64url')
  return `${expiry}.${signature}`
}
export function verifyPurchaseAccess(purchaseId: string, token: string | null | undefined, now = Date.now()): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !token || token.length > 150) return false
  const [expiry, signature, extra] = token.split('.')
  if (extra || !/^\d{10}$/.test(expiry ?? '') || !signature || Number(expiry) <= Math.floor(now / 1000)) return false
  const expected = createHmac('sha256', key).update(`rwnak-access-v1:${purchaseId}:${expiry}`).digest()
  const actual = Buffer.from(signature, 'base64url')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
export function purchaseSuccessUrl(appUrl: string, id: string): string {
  const url = new URL('/success', appUrl)
  url.searchParams.set('purchaseId', id)
  url.searchParams.set('access', createPurchaseAccess(id))
  return url.toString()
}
export async function purchaseReader(request: NextRequest, id: string, access?: string | null) {
  if (verifyPurchaseAccess(id, access)) return { guest: true, userId: null }
  const { createServerClient } = await import('@supabase/ssr')
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} }
  })
  const { data: { user } } = await client.auth.getUser()
  return { guest: false, userId: user?.id ?? null }
}
