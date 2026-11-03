import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { buildSnapReport } from '@/lib/snap-report'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function GET(request: NextRequest) {
  const { user, error } = await requireAdmin(request, ['super_admin'])
  if (error) return error
  if (!rateLimit(`snap-report:${user!.id}`, 20, 60_000)) return NextResponse.json({ error: 'انتظر قليلاً قبل تحديث التقرير' }, { status: 429 })
  const days = Number(request.nextUrl.searchParams.get('days') ?? '7')
  const account = request.nextUrl.searchParams.get('account')
  if (![1, 7, 30].includes(days) || (account && !/^[0-9a-f-]{36}$/i.test(account))) return NextResponse.json({ error: 'فترة أو حساب غير صالح' }, { status: 400 })
  try {
    const report = await buildSnapReport(days, account)
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.warn('[snap/report] report unavailable', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'تعذر تحميل التقرير. حاول مجدداً وتأكد من صلاحيات اتصال سناب.' }, { status: 503 })
  }
}
