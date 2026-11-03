import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { buildSnapReport } from '@/lib/snap-report'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const supplied = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return new NextResponse(null, { status: 401 })
  // Serial execution prevents concurrent refresh-token rotations. Read-only
  // reporting never creates campaigns or changes advertising expenditure.
  const periods = []
  for (const days of [1, 7, 30]) {
    try { const report = await buildSnapReport(days); periods.push({ days, generatedAt: report.generatedAt, ok: true }) }
    catch { periods.push({ days, ok: false }) }
  }
  return NextResponse.json({ periods }, { status: periods.every(p => p.ok) ? 200 : 503 })
}
