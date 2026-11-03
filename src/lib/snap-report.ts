import { getAdminDb } from '@/lib/admin-db'
import { getSnapAccessToken, listSnapAdAccounts, type SnapAdAccount } from '@/lib/snap-marketing'
import { SNAP_MARKETING_ORG } from '@/lib/snap-marketing-crypto'
import { EMPTY_SNAP_COSTS, SNAP_REPORT_FIELDS, snapReportRange, parseSnapMetrics, snapMetricAmounts, observedSnapMargin, type SnapCosts } from '@/lib/snap-report-math'

const API_ORIGIN = 'https://adsapi.snapchat.com'
const success = (value: unknown) => String(value).toUpperCase() === 'SUCCESS'
type WireStat = { id: string; stats?: Record<string, unknown>; finalized_data_end_time?: string; conversion_data_processed_end_time?: string; breakdown_stats?: { campaign?: WireStat[] } }
type WirePage = { request_status: string; total_stats?: { sub_request_status: string; total_stat: WireStat }[];
  campaigns?: { campaign?: { id: string; name: string } }[]; paging?: { next_link?: string } }

async function snapPages(path: string, token: string) {
  const first = new URL(`${API_ORIGIN}/v1/${path}`)
  let url: URL | null = first
  const pages: WirePage[] = []
  for (let page = 0; url && page < 20; page++) {
    if (url.origin !== API_ORIGIN || url.pathname !== first.pathname || url.username || url.password) throw new Error('Invalid report pagination')
    const response: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`Snap report request failed (${response.status})`)
    const body: WirePage = await response.json()
    if (!success(body.request_status)) throw new Error('Snap report response failed')
    pages.push(body)
    url = body.paging?.next_link ? new URL(body.paging.next_link, API_ORIGIN) : null
  }
  if (url) throw new Error('Snap report pagination exceeded')
  return pages
}

async function fetchAccountStats(account: SnapAdAccount, days: number, token: string) {
  const range = snapReportRange(days)
  const params = new URLSearchParams({ granularity: 'TOTAL', fields: SNAP_REPORT_FIELDS.join(','), start_time: range.start, end_time: range.end,
    swipe_up_attribution_window: '7_DAY', view_attribution_window: '1_DAY', action_report_time: 'conversion', omit_empty: 'false', limit: '200' })
  const [totalPages, breakdownPages, campaignPages] = await Promise.all([
    snapPages(`adaccounts/${account.id}/stats?${params}`, token),
    snapPages(`adaccounts/${account.id}/stats?${params}&breakdown=campaign`, token).catch(() => null),
    snapPages(`adaccounts/${account.id}/campaigns?limit=200`, token).catch(() => null),
  ])
  const totals = totalPages.flatMap(p => p.total_stats ?? [])
  if (totals.length !== 1 || !success(totals[0].sub_request_status) || totals[0].total_stat?.id !== account.id || !totals[0].total_stat.stats) throw new Error('Incomplete Snap account totals')
  const total = totals[0].total_stat
  const metrics = parseSnapMetrics(total.stats!)
  const names = new Map<string, string>()
  for (const page of campaignPages ?? []) for (const item of page.campaigns ?? []) if (item.campaign?.id) names.set(item.campaign.id, item.campaign.name)
  const campaigns: { id: string; name: string; metrics: ReturnType<typeof parseSnapMetrics>; amounts: ReturnType<typeof snapMetricAmounts> }[] = []
  const seen = new Set<string>()
  let campaignsComplete = !!breakdownPages
  for (const page of breakdownPages ?? []) for (const entry of page.total_stats ?? []) {
    if (!success(entry.sub_request_status)) { campaignsComplete = false; continue }
    for (const campaign of entry.total_stat?.breakdown_stats?.campaign ?? []) {
      if (seen.has(campaign.id)) continue
      seen.add(campaign.id)
      const campaignMetrics = parseSnapMetrics(campaign.stats ?? {})
      campaigns.push({ id: campaign.id, name: names.get(campaign.id) ?? campaign.id, metrics: campaignMetrics, amounts: snapMetricAmounts(campaignMetrics) })
    }
  }
  campaigns.sort((a, b) => (b.amounts.spend ?? 0) - (a.amounts.spend ?? 0))
  return { range, metrics, amounts: snapMetricAmounts(metrics), campaigns, campaignsComplete,
    finalizedThrough: total.finalized_data_end_time ?? null, conversionsProcessedThrough: total.conversion_data_processed_end_time ?? null }
}

async function websiteSales(accountId: string, range: ReturnType<typeof snapReportRange>) {
  const db = getAdminDb()
  type Sale = { amount: number; currency: string; status: string; purchase_marketing_attribution: { account_id: string | null; medium: string } | null }
  const all: Sale[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db.from('purchases').select('amount,currency,status,purchase_marketing_attribution(account_id,medium)')
      .in('status', ['completed', 'refunded']).gte('paid_at', range.start).lt('paid_at', range.end).order('id').range(page * 1000, page * 1000 + 999)
    if (error) throw new Error('Website sales could not be read')
    all.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
    if (page === 19) throw new Error('Website report exceeds safe row limit')
  }
  const siteRevenue: Record<string, number> = {}
  let sitePaidOrders = 0, taggedOrders = 0, taggedGrossOrders = 0, taggedRevenueKwd = 0, taggedGrossKwd = 0, taggedRefundsKwd = 0
  for (const sale of all) {
    const amount = Number(sale.amount)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid website sale amount')
    if (sale.status === 'completed') { sitePaidOrders++; siteRevenue[sale.currency] = (siteRevenue[sale.currency] ?? 0) + amount }
    const tag = sale.purchase_marketing_attribution
    if (tag?.account_id !== accountId || tag.medium !== 'paid_social' || sale.currency !== 'KWD') continue
    taggedGrossOrders++; taggedGrossKwd += amount
    if (sale.status === 'completed') { taggedOrders++; taggedRevenueKwd += amount } else taggedRefundsKwd += amount
  }
  return { sitePaidOrders, siteRevenue, taggedOrders, taggedGrossOrders, taggedRevenueKwd, taggedGrossKwd, taggedRefundsKwd }
}

export async function snapPurchaseVerification() {
  const { data, error } = await getAdminDb().from('snap_purchase_outbox')
    .select('sent_at,last_http_status,purchases!inner(status,amount,currency,paid_at)')
    .eq('purchases.status', 'completed').gte('purchases.paid_at', '2026-11-03T18:23:36Z').order('sent_at', { ascending: false, nullsFirst: false }).limit(10)
  if (error) throw new Error('Purchase verification unavailable')
  const delivered = (data ?? []).filter((row: { sent_at: string | null }) => row.sent_at)
  return { verified: delivered.length > 0, recentDeliveredCount: delivered.length,
    latest: delivered[0] ? { paidAt: delivered[0].purchases.paid_at, sentAt: delivered[0].sent_at, amount: delivered[0].purchases.amount, currency: delivered[0].purchases.currency } : null,
    note: 'قبول حدث شراء من السيرفر لا يثبت أن الطلب جاء من إعلان سناب.' }
}

export async function buildSnapReport(days: number, requestedAccountId?: string | null, persist = true) {
  const token = await getSnapAccessToken()
  const accounts = await listSnapAdAccounts(token)
  const account = requestedAccountId ? accounts.find(a => a.id === requestedAccountId) : accounts.find(a => a.name === 'rwnak website') ?? accounts[0]
  if (!account) throw new Error('Ad account is not available to this connection')
  const db = getAdminDb()
  const [{ data: settings, error: settingsError }, stats, verification, { data: product }] = await Promise.all([
    db.from('snap_reporting_settings').select('usd_kwd_rate,payment_fee_percent,payment_fee_fixed_kwd,operating_cost_kwd_daily').eq('organization_id', SNAP_MARKETING_ORG).maybeSingle(),
    fetchAccountStats(account, days, token), snapPurchaseVerification(),
    db.from('store_settings').select('product_name,product_price,product_currency').limit(1).maybeSingle(),
  ])
  if (settingsError) throw new Error('Reporting configuration unavailable')
  const costs: SnapCosts = settings ? Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value === null ? null : Number(value)])) as SnapCosts : EMPTY_SNAP_COSTS
  const sales = await websiteSales(account.id, stats.range)
  const report = { generatedAt: new Date().toISOString(), account, accounts, ...stats, website: sales, costs, verification, product,
    attribution: { swipeDays: 7, viewDays: 1, reportTime: 'conversion', websiteRule: 'رابط سناب مدفوع موسوم بالحساب خلال 30 يوماً وبموافقة الزائر؛ لا تُنسب الطلبات القديمة تلقائياً.' },
    margin: observedSnapMargin(sales.taggedRevenueKwd, sales.taggedGrossKwd, sales.taggedGrossOrders, stats.amounts.spend, account.currency, days, costs) }
  if (persist) {
    const { error } = await db.from('snap_report_snapshots').upsert({ account_id: account.id, period_days: days, generated_at: report.generatedAt, report }, { onConflict: 'account_id,period_days' })
    if (error) throw new Error('Report snapshot could not be saved')
  }
  return report
}
