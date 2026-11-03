import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { snapMarketingConfigured, SNAP_MARKETING_ORG } from '@/lib/snap-marketing-crypto'
import { getSnapAccessToken, listSnapAdAccounts } from '@/lib/snap-marketing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request, ['super_admin'])
  if (error) return error
  const headers = { 'Cache-Control': 'no-store' }
  if (!snapMarketingConfigured()) return NextResponse.json({ configured: false, connected: false }, { headers })
  const { data, error: dbError } = await getAdminDb().from('snap_marketing_connections')
    .select('connected_at,expires_at').eq('organization_id', SNAP_MARKETING_ORG).maybeSingle()
  if (dbError) return NextResponse.json({ error: 'تعذر قراءة حالة الربط' }, { status: 503, headers })
  if (!data) return NextResponse.json({ configured: true, connected: false }, { headers })
  try {
    const accounts = await listSnapAdAccounts(await getSnapAccessToken())
    return NextResponse.json({ configured: true, connected: true, verified: true, connectedAt: data.connected_at, accounts }, { headers })
  } catch {
    return NextResponse.json({ configured: true, connected: true, verified: false, error: 'تعذر التحقق من الاتصال؛ حاول مجدداً أو أعد التفويض' }, { headers })
  }
}
