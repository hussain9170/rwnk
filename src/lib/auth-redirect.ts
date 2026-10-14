// Keep login and recovery redirects on this application, including malformed URLs.
export function safeAuthPath(next: string | null | undefined): string {
  if (!next?.startsWith('/') || next.startsWith('//') || /[\\\x00-\x20]/.test(next)) return '/library'
  try {
    const url = new URL(next, 'https://auth.local')
    return url.origin === 'https://auth.local' ? url.pathname + url.search + url.hash : '/library'
  } catch { return '/library' }
}
