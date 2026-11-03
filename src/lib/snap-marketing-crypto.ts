import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const SNAP_MARKETING_ORG = '54c2bdfb-3c68-4b72-af12-019ae7d424a6'
export const SNAP_MARKETING_ORIGIN = 'https://www.rwnak.net'
export const SNAP_MARKETING_CALLBACK = `${SNAP_MARKETING_ORIGIN}/api/integrations/snapchat/callback`
export const SNAP_MARKETING_COOKIE = '__Host-rwnak_snap_oauth'

export function tokenKey() {
  const value = process.env.SNAP_MARKETING_TOKEN_KEY ?? ''
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Snap token encryption is not configured')
  return Buffer.from(value, 'hex')
}

export function encryptSnapTokens(value: object): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv)
  cipher.setAAD(Buffer.from(`rwnak:snap-marketing:v1:${SNAP_MARKETING_ORG}`))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptSnapTokens<T>(value: string): T {
  const [version, iv, tag, encrypted, extra] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted || extra) throw new Error('Invalid Snap token envelope')
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'base64url'))
  decipher.setAAD(Buffer.from(`rwnak:snap-marketing:v1:${SNAP_MARKETING_ORG}`))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')) as T
}

export function snapStateHash(state: string) {
  return createHash('sha256').update(state).digest('hex')
}

export function matchesSnapState(state: string | null, cookie: string | undefined) {
  return !!state && !!cookie && /^[a-f0-9]{64}$/.test(state) && /^[a-f0-9]{64}$/.test(cookie)
    && timingSafeEqual(Buffer.from(state), Buffer.from(cookie))
}

export function snapMarketingConfigured() {
  return !!process.env.SNAP_MARKETING_CLIENT_ID && !!process.env.SNAP_MARKETING_CLIENT_SECRET
    && /^[a-f0-9]{64}$/i.test(process.env.SNAP_MARKETING_TOKEN_KEY ?? '')
}
