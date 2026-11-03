export const SNAP_REPORT_FIELDS = ['impressions', 'swipes', 'spend', 'conversion_purchases', 'conversion_purchases_value', 'conversion_start_checkout', 'conversion_view_content'] as const
export type SnapMetric = typeof SNAP_REPORT_FIELDS[number]
export type SnapMetrics = Record<SnapMetric, number | null>
export type SnapCosts = { usd_kwd_rate: number | null; payment_fee_percent: number | null; payment_fee_fixed_kwd: number | null; operating_cost_kwd_daily: number | null }
export const EMPTY_SNAP_COSTS: SnapCosts = { usd_kwd_rate: null, payment_fee_percent: null, payment_fee_fixed_kwd: null, operating_cost_kwd_daily: null }

export function snapReportRange(days: number, now = new Date()) {
  if (![1, 7, 30].includes(days)) throw new Error('Invalid report period')
  const local = new Date(now.getTime() + 3 * 3600000)
  const end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 3 * 3600000
  return { days, start: new Date(end - days * 86400000).toISOString(), end: new Date(end).toISOString(), timezone: 'Asia/Kuwait' }
}

export function parseSnapMetrics(raw: Record<string, unknown>): SnapMetrics {
  return Object.fromEntries(SNAP_REPORT_FIELDS.map(key => {
    const value = raw[key]
    if (value === null || value === undefined) return [key, null]
    if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw new Error('Invalid Snap numeric metric')
    return [key, Number(value)]
  })) as SnapMetrics
}

export function snapMetricAmounts(stats: SnapMetrics) {
  const spend = stats.spend === null ? null : stats.spend / 1_000_000
  const purchaseValue = stats.conversion_purchases_value === null ? null : stats.conversion_purchases_value / 1_000_000
  return { spend, purchaseValue,
    costPerPurchase: spend !== null && stats.conversion_purchases ? spend / stats.conversion_purchases : null,
    roas: spend && purchaseValue !== null ? purchaseValue / spend : null }
}

export function validateSnapCosts(value: Record<string, unknown>): SnapCosts {
  const result = { ...EMPTY_SNAP_COSTS }
  for (const key of Object.keys(result) as (keyof SnapCosts)[]) {
    const item = value[key]
    if (item === null) continue
    if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) throw new Error('Invalid cost setting')
    if ((key === 'usd_kwd_rate' && (item <= 0 || item > 10)) || (key === 'payment_fee_percent' && item > 100) || item > 100_000) throw new Error('Cost setting out of range')
    result[key] = item
  }
  return result
}

export function observedSnapMargin(revenueKwd: number, grossKwd: number, orders: number, spend: number | null, currency: string, days: number, costs: SnapCosts) {
  const missing = Object.entries(costs).filter(([key, value]) => value === null && !(key === 'usd_kwd_rate' && currency === 'KWD')).map(([key]) => key)
  if (missing.length || spend === null || !['USD', 'KWD'].includes(currency)) return { estimateKwd: null, missing, spendKwd: null }
  const spendKwd = currency === 'KWD' ? spend! : spend! * costs.usd_kwd_rate!
  const fees = grossKwd * costs.payment_fee_percent! / 100 + orders * costs.payment_fee_fixed_kwd!
  return { estimateKwd: revenueKwd - spendKwd - fees - days * costs.operating_cost_kwd_daily!, spendKwd, missing }
}
