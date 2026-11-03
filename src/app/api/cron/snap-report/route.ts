import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { buildSnapReport } from '@/lib/snap-report'
import { getSnapAccessToken, listSnapAdAccounts } from '@/lib/snap-marketing'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const supplied = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return new NextResponse(null, { status: 401 })
  // Refresh once before parallel account groups, then reuse the short-lived
  // server token without exposing it in any saved report or response.
  let context
  try { const token = await getSnapAccessToken(); context = { token, accounts: await listSnapAdAccounts(token) } }
  catch { return NextResponse.json({ error: 'Snap connection unavailable' }, { status: 503 }) }
  const groups = await Promise.all(context.accounts.map(async account => {
    const results = []
    for (const days of [1, 7, 30]) {
      try { const report = await buildSnapReport(days, account.id, true, context); results.push({ accountId: account.id, days, generatedAt: report.generatedAt, ok: true }) }
      catch { results.push({ accountId: account.id, days, ok: false }) }
    }
    return results
  }))
  const periods = groups.flat()
  return NextResponse.json({ periods }, { status: periods.every(p => p.ok) ? 200 : 503 })
}
