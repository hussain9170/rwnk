import { randomUUID } from 'node:crypto'

// Reserve the existing purchase row atomically before contacting the gateway.
// Never expire/reclaim an ambiguous attempt: that could create a second invoice.
export async function reservePaymentAttempt(sb: any, purchaseId: string) {
  const claim = `creating:${randomUUID()}`
  const { data, error } = await sb.from('purchases').update({ payment_ref: claim })
    .eq('id', purchaseId).eq('status', 'pending').is('payment_ref', null).select('id').maybeSingle()
  if (error) return { state: 'error' as const }
  if (data) return { state: 'claimed' as const, claim }
  const { data: existing } = await sb.from('purchases').select('status,payment_ref,transaction_details').eq('id', purchaseId).single()
  const details = existing?.transaction_details
  if (existing?.status === 'pending' && details?.checkout_invoice_id === existing.payment_ref && typeof details?.checkout_payment_url === 'string') {
    return { state: 'ready' as const, url: details.checkout_payment_url, invoiceId: existing.payment_ref }
  }
  return { state: 'busy' as const }
}

export async function savePaymentAttempt(sb: any, purchaseId: string, claim: string, invoiceId: string, paymentUrl: string) {
  const { data, error } = await sb.from('purchases').update({
    payment_ref: invoiceId,
    transaction_details: { checkout_invoice_id: invoiceId, checkout_payment_url: paymentUrl },
  }).eq('id', purchaseId).eq('payment_ref', claim).eq('status', 'pending').select('id').maybeSingle()
  return !error && !!data
}
