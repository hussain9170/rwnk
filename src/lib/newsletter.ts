import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './env'
import { NEWSLETTER_COPY, NEWSLETTER_VERSION } from './policy-consent'

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export const validNewsletterToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
export function newsletterDb() {
  const { url, key } = getSupabaseServerEnv()
  if (!url || !key) throw new Error('Newsletter database unavailable')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function resendRequest(path: string, method: string, payload?: unknown) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Email service unavailable')
  return fetch(`https://api.resend.com${path}`, {
    method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(10000), cache: 'no-store',
  })
}

export async function requestNewsletter(email: string) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email service unavailable')
  const sb = newsletterDb()
  const digest = tokenHash(`newsletter:${email}`)
  const { data: allowed, error: limitError } = await sb.rpc('allow_request', { p_key: digest, p_max: 3, p_seconds: 3600 })
  if (limitError) throw new Error('Rate limit unavailable')
  // Same response for repeated addresses; never disclose membership.
  if (!allowed) return
  const { data: cooldown, error: cooldownError } = await sb.rpc('allow_request', { p_key: tokenHash(`newsletter-cooldown:${email}`), p_max: 1, p_seconds: 60 })
  if (cooldownError) throw new Error('Rate limit unavailable')
  if (!cooldown) return
  const token = randomBytes(32).toString('hex')
  const { data: signup, error } = await sb.from('newsletter_signups').insert({
    email, token_hash: tokenHash(token), expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    consent_version: NEWSLETTER_VERSION, consent_text: NEWSLETTER_COPY, source: 'website_footer',
  }).select('id').single()
  if (error || !signup) throw new Error('Could not record newsletter request')
  // Fixed first-party origin: never trust Host/Origin to build email links.
  const confirmUrl = `https://www.rwnak.net/newsletter/confirm?token=${token}`
  const unsubscribeUrl = `https://www.rwnak.net/newsletter/unsubscribe?token=${unsubscribeToken(signup.id)}`
  const text = `أهلاً في رونق\nطلبتِ الاشتراك بنصائح تنظيم المنزل وأخبار وعروض رونق.\nلتأكيد اشتراكك، افتحي الرابط واضغطي تأكيد الاشتراك:\n${confirmUrl}\nالرابط صالح لمدة 24 ساعة. إذا ما طلبتِ الاشتراك، تجاهلي الرسالة ولن نضيفك للقائمة.\nلإلغاء الاشتراك أو إيقاف هذا الطلب: ${unsubscribeUrl}\nرونق | info@rwnak.net`
  const response = await resendRequest('/emails', 'POST', {
    from: process.env.EMAIL_FROM, to: [email], subject: 'أكّدي اشتراكك في بريد رونق', text,
    html: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تأكيد اشتراك رونق</title></head><body style="margin:0;padding:24px;background:#F7F4FC;font-family:Tahoma,Arial,sans-serif;color:#352D42"><table role="presentation" style="max-width:560px;margin:auto;background:white;border-radius:16px;width:100%"><tr><td style="padding:32px;line-height:1.9"><h1 style="color:#6747B2;font-size:24px">أهلاً في رونق</h1><p>طلبتِ الاشتراك بنصائح تنظيم المنزل وأخبار وعروض رونق. أكّدي اشتراكك من الزر:</p><p><a href="${confirmUrl}" style="display:inline-block;padding:14px 24px;background:#6747B2;color:white;border-radius:10px;text-decoration:none">تأكيد الاشتراك</a></p><p>الرابط صالح لمدة 24 ساعة. إذا ما طلبتِ الاشتراك، تجاهلي الرسالة ولن نضيفك للقائمة.</p><p><a href="${unsubscribeUrl}">إلغاء الاشتراك أو إيقاف هذا الطلب</a></p><p style="font-size:13px">رونق · <a href="https://www.rwnak.net/privacy">سياسة الخصوصية</a> · info@rwnak.net</p></td></tr></table></body></html>`,
  })
  if (!response.ok) {
    await sb.from('newsletter_signups').update({ status: 'send_failed' }).eq('id', signup.id)
    throw new Error('Could not send newsletter confirmation')
  }
}

export async function confirmNewsletter(token: string) {
  const { data, error } = await newsletterDb().rpc('confirm_newsletter_signup', { p_hash: tokenHash(token) })
  if (error) throw new Error('Could not confirm newsletter signup')
  return data === true
}

export function unsubscribeToken(id: string) {
  const { key } = getSupabaseServerEnv()
  if (!key) throw new Error('Newsletter signing unavailable')
  return `${id}.${createHmac('sha256', key).update(`newsletter-unsubscribe:${id}`).digest('hex')}`
}

export function unsubscribeId(token: unknown) {
  if (typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{64}$/.test(token)) return null
  const [id, signature] = token.split('.')
  const expected = unsubscribeToken(id).split('.')[1]
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex')) ? id : null
}
