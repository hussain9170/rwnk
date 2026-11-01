import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Search agents share the same public-content boundaries. This does not
      // change training-bot preferences or grant access to protected downloads.
      { userAgent: ['*', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'], allow: '/', disallow: ['/admin', '/api', '/auth', '/library', '/account', '/newsletter'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
