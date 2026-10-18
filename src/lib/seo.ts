import type { Metadata } from 'next'

// Public search URLs describe production, never a preview deployment host.
export const SITE_URL = 'https://www.rwnak.net'
export const SITE_NAME = 'رَوْنَق'
export const SHARE_IMAGE = { url: `${SITE_URL}/rwnak-guide-preview.png`, width: 800, height: 600, alt: 'رَوْنَق — دليل تدريب العاملة وتنظيم التنظيف المنزلي' }

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = new URL(path, SITE_URL).toString()
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url, siteName: SITE_NAME, locale: 'ar_KW', type: 'website', images: [SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: [SHARE_IMAGE.url] },
  }
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: new URL(item.path, SITE_URL).toString() })) }
}
