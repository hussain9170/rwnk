import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const PIXEL_CODE = 'DBMFUP3C77UA5QM455NG'
export const TIKTOK_PURCHASE_CONSENT_VERSION = 'tiktok-purchase-v1'
export interface TikTokPurchase {
  id: string; status: string; amount: number; currency: string; email: string
  paid_at: string | null; product_id: string | null
}
export interface TikTokReceipt {
  purchase_id: string; consent_version: string; consent_at: string
  revoked_at: string | null; ttp: string | null; client_user_agent: string | null; lease_id: string
}

// No access tokens, receipt URLs or raw email go into the advertising payload.
export function buildTikTokPurchase(p: TikTokPurchase, receipt: TikTokReceipt, now = Date.now()) {
  const paid = Date.parse(p.paid_at ?? '')
  const consent = Date.parse(receipt.consent_at)
  const amount = Number(p.amount)
  const email = p.email.trim().toLowerCase()
  if (p.status !== 'completed' || receipt.purchase_id !== p.id || receipt.revoked_at || receipt.consent_version !== TIKTOK_PURCHASE_CONSENT_VERSION) return null
  if (!Number.isFinite(paid) || !Number.isFinite(consent) || consent > paid || paid > now || now - paid >= 6 * 86400000) return null
  if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(p.currency) || !p.product_id || !/^[a-z0-9_-]{1,128}$/i.test(p.product_id)) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return {
    event: 'Purchase', event_time: Math.floor(paid / 1000),
    event_id: createHash('sha256').update(`rwnak-tiktok-purchase:${p.id}`).digest('hex'),
    user: {
      email: createHash('sha256').update(email).digest('hex'),
      ...(receipt.ttp ? { ttp: receipt.ttp } : {}),
      ...(receipt.client_user_agent ? { user_agent: receipt.client_user_agent } : {}),
    },
    page: { url: 'https://www.rwnak.net/checkout' },
    properties: { value: amount, currency: p.currency, content_type: 'product', content_ids: [p.product_id], quantity: 1,
      contents: [{ content_id: p.product_id, content_type: 'product', quantity: 1, price: amount }] },
  }
}

export async function flushTikTokPurchases(sb: SupabaseClient, purchaseId: string | null = null, send = fetch) {
  const token = process.env.TIKTOK_EVENTS_ACCESS_TOKEN
  if (!token) return { sent: 0, configured: false }
  let sent = 0
  let failed = 0
  try {
    const { data, error } = await sb.rpc('claim_tiktok_purchases', { p_purchase_id: purchaseId })
    if (error) return { sent, failed: 1, configured: true, queueAvailable: false }
    for (const receipt of (data ?? []) as TikTokReceipt[]) {
      try {
        const { data: p } = await sb.from('purchases').select('id,status,email,amount,currency,paid_at,product_id').eq('id', receipt.purchase_id).single()
        const { data: current } = await sb.from('tiktok_purchase_outbox').select('revoked_at').eq('purchase_id', receipt.purchase_id).single()
        const event = p && current && buildTikTokPurchase(p, { ...receipt, revoked_at: current.revoked_at })
        if (!event) continue
        const response = await send('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Access-Token': token },
          body: JSON.stringify({ event_source: 'web', event_source_id: PIXEL_CODE, data: [event] }),
          signal: AbortSignal.timeout(5000),
        })
        const result = await response.json().catch(() => null)
        const accepted = response.ok && result?.code === 0
        const { error: saveError } = await sb.from('tiktok_purchase_outbox').update({
          last_http_status: response.status, last_api_code: typeof result?.code === 'number' ? result.code : null,
          ...(accepted ? { sent_at: new Date().toISOString(), ttp: null, client_user_agent: null } : {}),
        }).eq('purchase_id', receipt.purchase_id).eq('lease_id', receipt.lease_id)
        if (accepted && !saveError) sent++
        else failed++
      } catch { failed++ }
    }
    // Expire optional matching data; retain consent and delivery metadata only.
    await sb.from('tiktok_purchase_outbox').update({ ttp: null, client_user_agent: null }).lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
  } catch { failed++ }
  if (failed) console.warn('[tiktok/events] delivery unconfirmed; retained for retry')
  return { sent, failed, configured: true, queueAvailable: true }
}
