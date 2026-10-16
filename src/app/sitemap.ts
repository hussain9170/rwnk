import { MetadataRoute } from 'next'
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.rwnak.net'
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/refund`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
