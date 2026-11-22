// Memory only: retry a gateway request against the same pending purchase.
// A client timeout does not cancel server processing; initiate reserves invoices.
export function createCheckoutSession(request: typeof fetch = fetch, gatewayTimeout = 30000) {
  let saved: { key: string; purchaseId: string; access: string } | undefined
  return async (payload: Record<string, unknown>) => {
    const key = JSON.stringify(payload)
    if (!saved || saved.key !== key) {
      const response = await request('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'تعذّر إنشاء الطلب')
      if (!data.purchaseId || !data.access) throw new Error('تعذّر تجهيز الطلب. تواصلي مع الدعم.')
      saved = { key, purchaseId: data.purchaseId, access: data.access }
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), gatewayTimeout)
    try {
      const response = await request('/api/payment/initiate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: saved.purchaseId, access: saved.access }), signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok || !data.paymentUrl) throw new Error(data.error ?? 'تعذّر بدء عملية الدفع')
      return data.paymentUrl as string
    } catch (error) {
      if (controller.signal.aborted) throw new Error('طال تجهيز بوابة الدفع. تقدرين تحاولين مرة ثانية على نفس الطلب، أو تتواصلين مع الدعم قبل تكرار الدفع.')
      throw error
    } finally { clearTimeout(timeout) }
  }
}
