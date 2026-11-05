import { timingSafeEqual, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { buildTikTokPurchase, TIKTOK_PURCHASE_CONSENT_VERSION } from '@/lib/tiktok-events'
import { DEFAULT_SETTINGS } from '@/lib/store-settings'

// Test-only endpoint: an expiring server credential AND a Test Events code
// are mandatory. Never reads/writes orders or calls the production queue.
export async function POST(request: NextRequest) {
  let authorization: { secret?: string; expires?: number } = {}
  try { authorization = JSON.parse(process.env.TIKTOK_TEST_AUTH ?? '{}') } catch { /* disabled */ }
  const expected = Buffer.from(`Bearer ${authorization.secret ?? ''}`)
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  if (!authorization.secret || !authorization.expires || Date.now() >= authorization.expires || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new NextResponse(null, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!/^TEST[0-9]{3,20}$/.test(body?.test_event_code ?? '')) return NextResponse.json({ error: 'A Test Events code is mandatory' }, { status: 400 })
  const token = process.env.TIKTOK_EVENTS_ACCESS_TOKEN
  if (!token) return NextResponse.json({ configured: false }, { status: 503 })
  const now = Date.now()
  const id = `test-${randomUUID()}`
  const event = buildTikTokPurchase({ id, status: 'completed', amount: 5, currency: 'KWD', email: 'integration-test@example.invalid', paid_at: new Date(now).toISOString(), product_id: DEFAULT_SETTINGS.product_id }, {
    purchase_id: id, consent_version: TIKTOK_PURCHASE_CONSENT_VERSION, consent_at: new Date(now).toISOString(), revoked_at: null, ttp: null, client_user_agent: null, lease_id: 'test-only',
  }, now)
  if (!event) return NextResponse.json({ error: 'Test fixture invalid' }, { status: 500 })
  event.event_id = `test_${event.event_id}`
  try {
    const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Access-Token': token },
      body: JSON.stringify({ event_source: 'web', event_source_id: 'DBMFUP3C77UA5QM455NG', test_event_code: body.test_event_code, data: [event] }), signal: AbortSignal.timeout(10000),
    })
    const result = await response.json().catch(() => null)
    return NextResponse.json({ testOnly: true, accepted: response.ok && result?.code === 0, httpStatus: response.status, apiCode: result?.code ?? null, requestId: result?.request_id ?? null, eventId: event.event_id })
  } catch { return NextResponse.json({ testOnly: true, accepted: false, error: 'TikTok request failed' }, { status: 502 }) }
}
