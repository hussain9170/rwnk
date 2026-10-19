import { NextRequest, NextResponse } from 'next/server'
import { publicRateLimit } from '@/lib/public-rate-limit'
import { requestNewsletter } from '@/lib/newsletter'

export async function POST(request: NextRequest) {
  const limited = await publicRateLimit(request, 'newsletter', 5, 600)
  if (limited) return limited
  try {
    const body = await request.json()
    if (body.website) return NextResponse.json({ ok: true })
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254 || body.consent !== true) return NextResponse.json({ error: 'أدخلي بريد صحيح ووافقي على الاشتراك.' }, { status: 400 })
    await requestNewsletter(email)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'ما قدرنا نرسل رسالة التفعيل، حاولي لاحقاً.' }, { status: 503 })
  }
}
