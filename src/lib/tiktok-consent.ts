export const TIKTOK_CONSENT_COOKIE = 'rwnak_tiktok_consent'
export const TIKTOK_PIXEL_CONSENT_COOKIE = 'rwnak_tiktok_pixel'
export const TIKTOK_CONSENT_CHANGE = 'rwnak:tiktok-consent-change'
export const TIKTOK_CONSENT_MAX_AGE = 180 * 24 * 60 * 60
export const TIKTOK_SETTINGS_CONSENT_VERSION = 'tiktok-settings-v1'

export function tiktokConsentId(value: string | undefined) {
  return value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : null
}

export function allowsTikTokPixel(cookie: string, globalPrivacyControl?: boolean) {
  return globalPrivacyControl !== true && cookie.split(';').some(entry => entry.trim() === `${TIKTOK_PIXEL_CONSENT_COOKIE}=1`)
}
