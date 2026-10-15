import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SNAP_PIXEL_ID = '92c5f03d-414c-48be-9bf2-12bbb0fbdbf4'

export interface SnapPurchase {
  id: string; status: string; amount: number; currency: string; email: string
  paid_at: string | null; invoice_number: string | null; product_id: string | null
}
export interface SnapReceipt {
  purchase_id: string; consent_id: string; consent_version: string; consent_at: string
  sc_click_id: string | null; sc_cookie1: string | null; revoked_at: string | null
  lease_id?: string
}

// Purchase IDs are bearer download credentials. Never expose their fallback
// value to advertising services. Public invoice numbers are safe to reuse.
export function snapOrderId(purchase: Pick<SnapPurchase, 'id' | 'invoice_number'>) {
  return purchase.invoice_number || createHash('sha256').update(`rwnak-order:${purchase.id}`).digest('hex')
}

export function buildSnapPurchase(p: SnapPurchase, receipt: SnapReceipt, now = Date.now()) {
  const paid = Date.parse(p.paid_at ?? '')
  const consentAt = Date.parse(receipt.consent_at)
  const email = p.email.trim().toLowerCase()
  const value = Number(p.amount)
  if (p.status !== 'completed' || receipt.purchase_id !== p.id || receipt.revoked_at || receipt.consent_version !== 'snap-v1') return null
  if (!Number.isFinite(paid) || !Number.isFinite(consentAt) || paid > now || now - paid >= 7 * 86400000 || consentAt > paid) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isFinite(value) || value <= 0 || !/^[A-Z]{3}$/.test(p.currency)) return null
  const id = snapOrderId(p)
  return {
    event_name: 'PURCHASE', event_id: id, event_time: paid, action_source: 'WEB',
    event_source_url: 'https://www.rwnak.net/checkout',
    user_data: {
      em: [createHash('sha256').update(email).digest('hex')],
      ...(receipt.sc_click_id ? { sc_click_id: receipt.sc_click_id } : {}),
      ...(receipt.sc_cookie1 ? { sc_cookie1: receipt.sc_cookie1 } : {}),
    },
    custom_data: { order_id: id, value, currency: p.currency, num_items: '1', ...(p.product_id ? { content_ids: [p.product_id] } : {}) },
  }
}

// Only the privileged server client can claim rows. RPC leases prevent
// concurrent callback/webhook/cron sends; stable IDs handle ambiguous retries.
export async function flushSnapPurchases(sb: SupabaseClient, purchaseId: string | null = null, send = fetch) {
  if (process.env.SNAP_CAPI_ENABLED !== 'true' || !process.env.SNAP_CAPI_ACCESS_TOKEN) return { sent: 0, skipped: true }
  let sent = 0
  try {
    const { data: receipts, error } = await sb.rpc('claim_snap_purchases', { p_purchase_id: purchaseId })
    if (error) { console.error('[snap/capi] claim failed', error.code); return { sent, error: true } }
    await Promise.all((receipts as SnapReceipt[] ?? []).map(async receipt => {
      try {
        const { data: p } = await sb.from('purchases').select('id,status,email,amount,currency,paid_at,invoice_number,product_id').eq('id', receipt.purchase_id).single()
        // Re-read revocation after claiming, immediately before transmission.
        const { data: current } = await sb.from('snap_purchase_outbox').select('revoked_at').eq('purchase_id', receipt.purchase_id).single()
        const event = p && current && buildSnapPurchase(p, { ...receipt, revoked_at: current.revoked_at })
        if (!event) return
        const endpoint = new URL(`https://tr.snapchat.com/v3/${SNAP_PIXEL_ID}/events`)
        endpoint.searchParams.set('access_token', process.env.SNAP_CAPI_ACCESS_TOKEN!)
        const res = await send(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [event] }), signal: AbortSignal.timeout(5000) })
        const result = await res.json().catch(() => null)
        const ok = res.ok && result?.status === 'VALID'
        const { error: saveError } = await sb.from('snap_purchase_outbox').update(ok ? { sent_at: new Date().toISOString(), last_http_status: res.status, sc_click_id: null, sc_cookie1: null } : { last_http_status: res.status }).eq('purchase_id', receipt.purchase_id).eq('lease_id', receipt.lease_id)
        if (ok && !saveError) sent++
        if (!ok || saveError) console.warn('[snap/capi] delivery not confirmed', res.status)
      } catch { console.warn('[snap/capi] transient delivery failure; retained for retry') }
    }))
  } catch { console.warn('[snap/capi] unavailable; purchase is unaffected') }
  return { sent }
}
