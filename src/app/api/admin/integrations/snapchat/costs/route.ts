import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { SNAP_MARKETING_ORG, SNAP_MARKETING_ORIGIN } from '@/lib/snap-marketing-crypto'
import { validateSnapCosts } from '@/lib/snap-report-math'

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request, ['super_admin'])
  if (error) return error
  if (request.headers.get('origin') !== SNAP_MARKETING_ORIGIN) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  let costs
  try { costs = validateSnapCosts(await request.json()) }
  catch { return NextResponse.json({ error: 'أدخل أرقاماً صالحة أو اترك الحقول المجهولة فارغة' }, { status: 400 }) }
  const { error: saveError } = await getAdminDb().from('snap_reporting_settings').upsert({ organization_id: SNAP_MARKETING_ORG, ...costs,
    updated_at: new Date().toISOString(), updated_by: user!.id }, { onConflict: 'organization_id' })
  if (saveError) return NextResponse.json({ error: 'تعذر حفظ نموذج التكاليف' }, { status: 503 })
  return NextResponse.json({ saved: true })
}
