import { NextRequest, NextResponse } from 'next/server'
import { newsletterDb, unsubscribeId } from '@/lib/newsletter'
import { publicRateLimit } from '@/lib/public-rate-limit'

export async function POST(request: NextRequest) {
  const limited = await publicRateLimit(request, 'newsletter-unsubscribe', 20, 600)
  if (limited) return limited
  try {
    const { token } = await request.json()
    const id = unsubscribeId(token)
    if (!id) return NextResponse.json({ error: 'رابط الإلغاء غير صالح.' }, { status: 400 })
    const { error } = await newsletterDb().rpc('unsubscribe_newsletter', { p_id: id })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'تعذّر الإلغاء الآن. حاولي لاحقاً أو راسلينا على info@rwnak.net.' }, { status: 503 }) }
}
