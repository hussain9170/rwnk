import { NextResponse } from 'next/server'

// A purchase/email pair must never authorize credential changes or account linking.
export async function POST() {
  return NextResponse.json({ error: 'افتحي رابط التحقق المرسل إلى بريدك أو سجّلي الدخول للوصول لحسابك.' }, { status: 410, headers: { 'Cache-Control': 'private, no-store' } })
}
