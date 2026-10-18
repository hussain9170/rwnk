import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { GUIDES } from '@/lib/guides'
import { publicMetadata, breadcrumbs, jsonLd } from '@/lib/seo'

export const metadata = publicMetadata('نصائح تدريب العاملة وتنظيم تنظيف البيت', 'مقالات عملية من رونق عن تدريب العاملة المنزلية وجدول تنظيف البيت وقوائم المتابعة، لمساعدتك على تنظيم روتين منزلك.', '/guides')

export default function GuidesPage() {
  return <><Navbar /><main className="guides-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs([{ name: 'الرئيسية', path: '/' }, { name: 'نصائح منزلية', path: '/guides' }])) }} />
    <nav aria-label="مسار التصفح" className="guide-breadcrumb"><Link href="/">الرئيسية</Link><span aria-hidden="true">/</span><span>نصائح منزلية</span></nav>
    <h1>تدريب أوضح، وروتين أرتب للبيت</h1>
    <p className="guide-intro">نصائح عملية تساعدك على شرح المهام للعاملة وتنظيم جدول التنظيف ومراجعة النتيجة. اختاري الموضوع اللي تحتاجينه وطبقيه بما يناسب بيتك.</p>
    <div className="guide-cards">{GUIDES.map(guide => <article className="guide-card" key={guide.slug}><h2><Link href={`/guides/${guide.slug}`}>{guide.title}</Link></h2><p>{guide.description}</p><Link className="guide-link" href={`/guides/${guide.slug}`}>اقرئي الخطوات ←</Link></article>)}</div>
    <aside className="guide-cta"><h2>تبين مرجعاً منظماً للتدريب والمتابعة؟</h2><p>تعرّفي على دليل رَوْنَق الرقمي، واللغات والمحتويات المتاحة قبل الشراء.</p><Link href="/#compare">شاهدي محتويات الدليل</Link></aside>
  </main><Footer showCta={false} /></>
}
