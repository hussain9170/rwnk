import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { GUIDES } from '@/lib/guides'
import { SITE_URL, SHARE_IMAGE, publicMetadata, breadcrumbs, jsonLd } from '@/lib/seo'

export const dynamicParams = false
export function generateStaticParams() { return GUIDES.map(guide => ({ slug: guide.slug })) }
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const guide = GUIDES.find(item => item.slug === slug)
  if (!guide) notFound()
  const base = publicMetadata(guide.title, guide.description, `/guides/${slug}`)
  return { ...base, openGraph: { ...base.openGraph, type: 'article' as const, publishedTime: `${guide.updated}T00:00:00+03:00`, modifiedTime: `${guide.updated}T00:00:00+03:00`, authors: ['رَوْنَق'] } }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = GUIDES.find(item => item.slug === slug)
  if (!guide) notFound()
  const path = `/guides/${slug}`
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: guide.title, description: guide.description, inLanguage: 'ar', image: SHARE_IMAGE.url, mainEntityOfPage: `${SITE_URL}${path}`, datePublished: `${guide.updated}T00:00:00+03:00`, dateModified: `${guide.updated}T00:00:00+03:00`, author: { '@type': 'Organization', name: 'رَوْنَق', url: `${SITE_URL}/about` }, publisher: { '@type': 'Organization', name: 'رَوْنَق', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo-icon.png` } } }
  return <><Navbar /><main className="guides-shell guide-article">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([article, breadcrumbs([{ name: 'الرئيسية', path: '/' }, { name: 'نصائح منزلية', path: '/guides' }, { name: guide.title, path }])]) }} />
    <nav aria-label="مسار التصفح" className="guide-breadcrumb"><Link href="/">الرئيسية</Link><span aria-hidden="true">/</span><Link href="/guides">نصائح منزلية</Link></nav>
    <article><header><p className="guide-byline">إعداد رَوْنَق · <time dateTime={guide.updated}>١٨ أكتوبر ٢٠٢٦</time></p><h1>{guide.title}</h1><p className="guide-intro">{guide.intro}</p></header>
      <nav aria-label="في هذا المقال" className="guide-toc"><strong>في هذا المقال</strong><ul>{guide.sections.map((section, i) => <li key={section.title}><a href={`#step-${i + 1}`}>{section.title}</a></li>)}</ul></nav>
      {guide.sections.map((section, i) => <section key={section.title} id={`step-${i + 1}`}><h2>{section.title}</h2><p>{section.text}</p>{section.points && <ul>{section.points.map(point => <li key={point}>{point}</li>)}</ul>}</section>)}
    </article>
    <aside className="guide-cta"><h2>من الشرح المتكرر إلى مرجع واحد</h2><p>دليل رَوْنَق يجمع خطوات وقوائم وجداول للتدريب والمتابعة بصيغة PDF. اختاري اللغة المناسبة، وراجعي المحتويات والسعر قبل الشراء.</p><Link href="/#compare">تعرّفي على دليل رَوْنَق</Link></aside>
    <section><h2>مواضيع مرتبطة</h2><ul>{GUIDES.filter(item => item.slug !== slug).map(item => <li key={item.slug}><Link className="guide-link" href={`/guides/${item.slug}`}>{item.title}</Link></li>)}</ul></section>
  </main><Footer showCta={false} /></>
}
