import { sendPurchaseConfirmationEmail, type PurchaseEmailParams } from './email'
import { getSingletonRow } from './db-resilience'
import { createPurchaseAccess } from './purchase-access'

// Queue creation is part of the same DB transaction as status=completed.
// Claims have leases; payloads and provider idempotency keys stay stable.
// Automatic retries stop within the provider's 24h deduplication window.
export async function flushPurchaseEmails(sb: any, purchaseId?: string) {
  const { data: jobs, error } = await sb.rpc('claim_purchase_emails', { p_purchase_id: purchaseId ?? null })
  if (error) { console.error('[purchase-email] queue unavailable', error.code); return { sent: 0, error: true, available: error.code !== 'PGRST202' } }
  let sent = 0
  for (const job of jobs ?? []) {
    try {
      let payload = job.payload as PurchaseEmailParams | null
      if (!payload) {
        const { data: purchase, error: purchaseError } = await sb.from('purchases').select('id,email,invoice_number,amount,currency,created_at,product_id,book_language,customer_name,status').eq('id', job.purchase_id).single()
        if (purchaseError || purchase?.status !== 'completed') throw new Error('purchase_unavailable')
        const [{ data: settings }, { data: product }] = await Promise.all([
          getSingletonRow<any>(sb, 'store_settings'),
          sb.from('products').select('name').eq('id', purchase.product_id).single(),
        ])
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
        if (!appUrl) throw new Error('missing_app_url')
        const successUrl = new URL('/success', appUrl)
        successUrl.searchParams.set('purchaseId', purchase.id)
        successUrl.searchParams.set('access', createPurchaseAccess(purchase.id, new Date(job.created_at).getTime()))
        payload = {
          to: purchase.email, language: purchase.book_language ?? 'ar',
          storeName: settings?.store_name ?? 'رَوْنَق', productName: product?.name ?? 'دليل رَوْنَق',
          invoiceNumber: purchase.invoice_number ?? purchase.id, amount: purchase.amount, currency: purchase.currency,
          purchaseDate: purchase.created_at, successUrl: successUrl.toString(), supportEmail: settings?.email ?? 'info@rwnak.net',
          websiteUrl: appUrl, logoUrl: settings?.logo_url ?? null, bookCoverUrl: settings?.product_image_url ?? null,
          customerName: purchase.customer_name ?? null, idempotencyKey: `purchase-confirmation-v1/${purchase.id}`,
        }
        const { error: persistError } = await sb.from('purchase_email_outbox').update({ payload }).eq('purchase_id', job.purchase_id)
        if (persistError) throw new Error('payload_not_saved')
      }
      const result = await sendPurchaseConfirmationEmail(payload)
      const { error: ackError } = await sb.from('purchase_email_outbox').update(result.ok
        ? { sent_at: new Date().toISOString(), lease_until: null, last_error: null }
        : { lease_until: null, last_error: result.reason ?? 'send_failed', next_attempt_at: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)).toISOString() }
      ).eq('purchase_id', job.purchase_id)
      if (ackError) console.error('[purchase-email] acknowledgement failed', ackError.code)
      if (result.ok) sent++
    } catch {
      await sb.from('purchase_email_outbox').update({ lease_until: null, last_error: 'preparation_failed', next_attempt_at: new Date(Date.now() + 300000).toISOString() }).eq('purchase_id', job.purchase_id)
      console.error('[purchase-email] preparation failed; queued for retry')
    }
  }
  return { sent, error: false, available: true }
}
