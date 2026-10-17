import { publicRateLimit } from '@/lib/public-rate-limit'
import { purchaseReader } from '@/lib/purchase-access'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { mintDownloadToken } from '@/lib/payment-access'

export const dynamic = 'force-dynamic'

// download_tokens has no INSERT policy for anon/authenticated by design —
// token creation only ever happens here, server-side, after real checks.
export async function POST(request: NextRequest) {
  const limited = await publicRateLimit(request, 'download-token', 30)
  if (limited) return limited
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }
  const purchaseId = typeof body?.purchaseId === 'string' ? body.purchaseId : ''
  if (!purchaseId) return NextResponse.json({ error: 'رقم الطلب مفقود' }, { status: 400 })

  const { url: sbUrl, key: sbKey } = getSupabaseServerEnv()
  if (!sbUrl || !sbKey) return NextResponse.json({ error: 'الخدمة غير مهيأة، حاولي لاحقاً' }, { status: 500 })

  const reader = await purchaseReader(request, purchaseId, typeof body.access === 'string' ? body.access : null)
  if (!reader.guest && !reader.userId) return NextResponse.json({ error: 'سجّلي الدخول أو افتحي رابط الاستلام من بريدك.' }, { status: 401 })
  const sessionUserId = reader.userId

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(sbUrl, sbKey) as any

  const { data: purchase, error } = await sb.from('purchases')
    .select('id,user_id,status,downloads_limit,downloads_used')
    .eq('id', purchaseId).single()

  if (error || !purchase) {
    console.error(`[download/token] purchase ${purchaseId} not found: ${error?.message ?? 'no row'}`)
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
  }
  if (purchase.status !== 'completed') {
    console.warn(`[download/token] purchase ${purchaseId} is not completed (status=${purchase.status}) — refusing token`)
    return NextResponse.json({ error: 'لم تكتمل عملية الدفع لهذا الطلب' }, { status: 403 })
  }
  if (!reader.guest && purchase.user_id !== sessionUserId) {
    console.error(`[download/token] session user ${sessionUserId} does not own purchase ${purchaseId} (owner=${purchase.user_id})`)
    return NextResponse.json({ error: 'غير مصرح لك بتحميل هذا الطلب' }, { status: 403 })
  }
  if ((purchase.downloads_used ?? 0) >= (purchase.downloads_limit ?? 0)) {
    console.warn(`[download/token] purchase ${purchaseId} hit its download limit (${purchase.downloads_used}/${purchase.downloads_limit})`)
    return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 403 })
  }

  const token = await mintDownloadToken(sb, purchase.id, sessionUserId ?? purchase.user_id ?? null)
  if (!token) {
    console.error(`[download/token] failed to create token for purchase ${purchaseId}`)
    return NextResponse.json({ error: 'تعذّر إنشاء رابط التحميل' }, { status: 500 })
  }

  console.log(`[download/token] issued token for purchase ${purchaseId} (user=${sessionUserId ?? purchase.user_id ?? 'guest'})`)
  return NextResponse.json({ token })
}
