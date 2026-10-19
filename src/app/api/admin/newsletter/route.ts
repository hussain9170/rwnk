import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { unsubscribeToken } from '@/lib/newsletter'

const headers = { 'Cache-Control': 'no-store' }
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request)
  if (authError) return authError
  const sb = getAdminDb()
  const exporting = request.nextUrl.searchParams.get('export') === 'csv'
  const page = Math.max(0, Math.min(100000, Math.floor(Number(request.nextUrl.searchParams.get('page')) || 0)))
  if (!exporting) {
    const { data, error, count } = await sb.from('newsletter_members').select('email,confirmed_at', { count: 'exact' }).is('unsubscribed_at', null).order('confirmed_at', { ascending: false }).range(page * 50, page * 50 + 49)
    if (error) return NextResponse.json({ error: 'تعذّر تحميل القائمة.' }, { status: 503, headers })
    return NextResponse.json({ data, total: count }, { headers })
  }
  const rows: { email: string; confirmed_at: string; signup_id: string }[] = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await sb.from('newsletter_members').select('email,confirmed_at,signup_id').is('unsubscribed_at', null).order('email').range(start, start + 999)
    if (error) return NextResponse.json({ error: 'تعذّر التصدير.' }, { status: 503, headers })
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`
  const csv = '\uFEFFemail,confirmed_at,unsubscribe_url\r\n' + rows.map(row => [row.email, row.confirmed_at, `https://www.rwnak.net/newsletter/unsubscribe?token=${unsubscribeToken(row.signup_id)}`].map(cell).join(',')).join('\r\n')
  return new NextResponse(csv, { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rwnak-newsletter.csv"' } })
}
