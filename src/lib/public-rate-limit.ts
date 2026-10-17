import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupabaseServerEnv } from './env'
import { clientIp, rateLimit } from './rate-limit'

// Coordinates across serverless instances. Store hashes, not raw IP addresses.
export async function publicRateLimit(request: Request, scope: string, max = 20, seconds = 60) {
  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) return NextResponse.json({ error: 'الخدمة غير متاحة مؤقتاً' }, { status: 503 })
  const digest = createHash('sha256').update(`${scope}:${clientIp(request)}`).digest('hex')
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb.rpc('allow_request', { p_key: digest, p_max: max, p_seconds: seconds })
  if (error?.code === 'PGRST202') return rateLimit(digest, max, seconds * 1000) ? null : NextResponse.json({ error: 'محاولات كثيرة، حاولي لاحقاً.' }, { status: 429, headers: { 'Retry-After': String(seconds) } })
  if (error) return NextResponse.json({ error: 'الخدمة غير متاحة مؤقتاً، حاولي لاحقاً.' }, { status: 503 })
  if (!data) return NextResponse.json({ error: 'محاولات كثيرة، انتظري قليلاً وحاولي مرة ثانية.' }, { status: 429, headers: { 'Retry-After': String(seconds) } })
  return null
}
