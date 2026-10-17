import { createPurchaseAccess } from '@/lib/purchase-access'
import { publicRateLimit } from '@/lib/public-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerEnv } from '@/lib/env'
import { insertWithSchemaFallback, getSingletonRow } from '@/lib/db-resilience'
import { SNAP_CONSENT_COOKIE, parseSnapConsent } from '@/lib/snap-consent'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_METHODS = new Set(['card', 'knet', 'apple'])
// Pre-dynamic-languages fallback ONLY — used when book_languages doesn't
// exist yet (migration not applied to this database). Once that table
// exists, resolveCheckoutLanguage below never consults this set.

// The client picks a language, but the PRICE already comes from
// store_settings (never the client) — this only decides which language code
// is safe to persist on the purchase. A client cannot buy an inactive or
// nonexistent language by editing the request body: this is looked up
// server-side against the live book_languages table, the same table the
// download route resolves the file from. Falls back to the legacy ar/en
// check only if the table itself doesn't exist yet (pre-migration database),
// so checkout never hard-fails just because this migration hasn't run.
async function resolveCheckoutLanguage(sb: any, requested: string): Promise<{ ok: true; language: string } | { ok: false }> {
  if (!requested) return { ok: false }

  const { data: lang, error } = await sb.from('book_languages').select('language_code,file_path').eq('language_code', requested).eq('is_active', true).maybeSingle()
  if (error) {
    console.error(`[checkout] book_languages lookup failed: ${error.message} — rejecting the requested language rather than guessing`)
    return { ok: false }
  }
  if (!lang || !lang.file_path) return { ok: false }
  return { ok: true, language: lang.language_code }
}

// Creates a pending purchase with a server-verified price — the client
// never gets to decide how much a purchase costs.
export async function POST(request: NextRequest) {
  const limited = await publicRateLimit(request, 'checkout', 12)
  if (limited) return limited
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const customerName = typeof body?.customerName === 'string' ? body.customerName.trim().slice(0, 200) : ''
  const paymentMethod = VALID_METHODS.has(body?.paymentMethod) ? body.paymentMethod : 'card'
  const requestedLanguage = typeof body?.bookLanguage === 'string' ? body.bookLanguage.trim().toLowerCase().slice(0, 10) : ''

  if (email.length > 254 || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
  }

  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) return NextResponse.json({ error: 'الخدمة غير مهيأة، حاولي لاحقاً' }, { status: 500 })

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key) as any

  const languageResolution = await resolveCheckoutLanguage(sb, requestedLanguage)
  if (!languageResolution.ok) {
    console.error(`[checkout] rejected purchase for [redacted] — requested language "${requestedLanguage}" does not exist or is not active`)
    return NextResponse.json({ error: 'اللغة المختارة غير متاحة حالياً' }, { status: 400 })
  }
  const bookLanguage = languageResolution.language

  // store_settings must hold exactly one row, but nothing at the DB level
  // enforces that — a live incident found a migration re-run's seed INSERT
  // silently created a second row, which made this bare .single() 500 on
  // EVERY checkout attempt (real customers could not purchase at all until
  // the duplicate was found and removed). getSingletonRow tolerates an
  // accidental duplicate instead of taking down checkout entirely.
  const { data: settings, error: settingsErr } = await getSingletonRow<{ product_id: string; product_price: number; product_currency: string }>(
    sb, 'store_settings', 'product_id,product_price,product_currency'
  )
  if (settingsErr || !settings) {
    console.error(`[checkout] failed to load product/price from store_settings: ${settingsErr?.message ?? 'no row found'}`)
    return NextResponse.json({ error: 'تعذّر تحميل بيانات المنتج' }, { status: 500 })
  }

  const purchasePayload: Record<string, unknown> = {
    product_id:     settings.product_id,
    email,
    guest_email:    email,
    amount:         settings.product_price,
    currency:       settings.product_currency ?? 'KWD',
    status:         'pending',
    payment_method: paymentMethod,
    book_language:  bookLanguage,
  }
  if (customerName) purchasePayload.customer_name = customerName

  // book_language and customer_name are both recent additions
  // (supabase/schema.sql §15/§16) that may not exist yet on a database that
  // hasn't had those migrations applied. Checkout is the one path in this
  // app that must never hard-fail just because an optional column is
  // missing, so this drops whichever of them the live schema doesn't have
  // (independently — either, both, or neither) and always completes the
  // insert with whatever columns DO exist.
  if (typeof body.expectedPrice === 'number' && body.expectedPrice !== Number(settings.product_price)) {
    return NextResponse.json({ error: 'تغيّر السعر. حدّثي الصفحة لمراجعة الإجمالي قبل الدفع.' }, { status: 409 })
  }

  const { data: purchase, error: insertErr, droppedFields } = await insertWithSchemaFallback<{ id: string; amount: number; currency: string }>(sb, 'purchases', purchasePayload)
  if (droppedFields.length > 0) {
    console.error(`[checkout] purchases columns not found — dropped from insert: ${droppedFields.join(', ')}. The migration in supabase/schema.sql has not been fully run against this database. RUN THE MIGRATION.`)
  }

  if (insertErr || !purchase) {
    console.error(`[checkout] failed to create pending purchase for [redacted]: ${insertErr?.message ?? 'insert returned no row'}`)
    return NextResponse.json({ error: 'تعذّر إنشاء الطلب، حاولي مرة أخرى' }, { status: 500 })
  }

  console.log(`[checkout] pending purchase created — id=${purchase.id} email=[redacted] amount=${purchase.amount} ${purchase.currency} method=${paymentMethod} language=${bookLanguage}`)

  // Failure to record optional advertising consent must never block payment.
  const consent = parseSnapConsent(request.cookies.get(SNAP_CONSENT_COOKIE)?.value)
  if (consent?.granted && request.headers.get('sec-gpc') !== '1') {
    try {
      const uuid = (v: string | undefined) => v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : null
      const { error } = await sb.from('snap_purchase_outbox').insert({
        purchase_id: purchase.id, consent_id: consent.receipt, consent_version: consent.version, consent_at: consent.at,
        sc_click_id: uuid(request.cookies.get('rwnak_snap_click')?.value), sc_cookie1: uuid(request.cookies.get('_scid')?.value),
      })
      if (error) console.warn('[snap/consent] receipt not recorded', error.code)
    } catch { console.warn('[snap/consent] unavailable; checkout unaffected') }
  }

  return NextResponse.json({ purchaseId: purchase.id, access: createPurchaseAccess(purchase.id), amount: purchase.amount, currency: purchase.currency })
}
