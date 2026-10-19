import { NextRequest, NextResponse } from 'next/server'
import { publicRateLimit } from '@/lib/public-rate-limit'
import { confirmNewsletter, validNewsletterToken } from '@/lib/newsletter'

export async function POST(request: NextRequest) {
  const limited = await publicRateLimit(request, 'newsletter-confirm', 15, 600)
  if (limited) return limited
  try {
    const { token } = await request.json()
    if (!validNewsletterToken(token)) return NextResponse.json({ error: 'رابط التفعيل غير صالح.' }, { status: 400 })
    if (!await confirmNewsletter(token)) return NextResponse.json({ error: 'الرابط منتهي أو غير صالح. اشتركي مرة ثانية من أسفل الموقع.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'تعذّر تأكيد الاشتراك. حاولي مرة ثانية بعد قليل.' }, { status: 503 })
  }
}
