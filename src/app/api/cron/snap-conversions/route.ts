import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { getSupabaseServerEnv } from '@/lib/env'
import { flushSnapPurchases } from '@/lib/snap-capi'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new NextResponse(null, { status: 401 })
  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) return new NextResponse(null, { status: 503 })
  const { createClient } = await import('@supabase/supabase-js')
  return NextResponse.json(await flushSnapPurchases(createClient(url, key)))
}
