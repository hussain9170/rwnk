import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'
import { GUIDES } from '@/lib/guides'
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/guides`, changeFrequency: 'monthly', priority: 0.7 },
    ...GUIDES.map(guide => ({ url: `${base}/guides/${guide.slug}`, lastModified: new Date(`${guide.updated}T00:00:00+03:00`), changeFrequency: 'monthly' as const, priority: 0.7 })),
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/refund`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
