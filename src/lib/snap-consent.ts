export const SNAP_CONSENT_COOKIE = 'rwnak_snap_consent'
export const SNAP_CONSENT_VERSION = 'snap-v1'
export const SNAP_CONSENT_EVENT = 'rwnak:snap-consent'

export function parseSnapConsent(value: string | undefined, now = Date.now()) {
  const parts = (value ?? '').split('.')
  const [version, choice, receipt, timestamp] = parts
  const time = Number(timestamp)
  if (parts.length !== 4 || version !== SNAP_CONSENT_VERSION || !['yes', 'no'].includes(choice)) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt ?? '')) return null
  if (!Number.isFinite(time) || time > now || now - time > 180 * 86400000) return null
  return { granted: choice === 'yes', receipt, at: new Date(time).toISOString(), version }
}

export function snapConsentValue() {
  if (typeof document === 'undefined') return ''
  return document.cookie.split('; ').find(v => v.startsWith(`${SNAP_CONSENT_COOKIE}=`))?.slice(SNAP_CONSENT_COOKIE.length + 1) ?? ''
}

export function hasSnapConsent() {
  if (typeof navigator === 'undefined') return false
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false
  return parseSnapConsent(snapConsentValue())?.granted === true
}

export function subscribeSnapConsent(listener: () => void) {
  window.addEventListener(SNAP_CONSENT_EVENT, listener)
  window.addEventListener('focus', listener)
  return () => {
    window.removeEventListener(SNAP_CONSENT_EVENT, listener)
    window.removeEventListener('focus', listener)
  }
}
