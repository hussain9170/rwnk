'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { buildSnapReport } from '@/lib/snap-report'
import styles from './report.module.css'

type Report = Awaited<ReturnType<typeof buildSnapReport>>
const costFields = [
  ['usd_kwd_rate', 'سعر تسوية الدولار بالدينار'],
  ['payment_fee_percent', 'رسوم الدفع النسبية %'],
  ['payment_fee_fixed_kwd', 'رسوم ثابتة لكل طلب بالدينار'],
  ['operating_cost_kwd_daily', 'تكاليف سناب الأخرى لكل يوم بالدينار'],
] as const
const n = (value: number | null | undefined, decimals = 0) => value === null || value === undefined ? 'غير متاح' : new Intl.NumberFormat('ar-KW', { maximumFractionDigits: decimals }).format(value)
const date = (value: string) => new Date(value).toLocaleDateString('ar-KW', { timeZone: 'Asia/Kuwait' })

export default function SnapReportPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [account, setAccount] = useState('')
  const [days, setDays] = useState(7)
  const [revision, setRevision] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const key = `${account}:${days}:${revision}`
  const loading = loadedKey !== key
  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ days: String(days), ...(account ? { account } : {}) })
    fetch(`/api/admin/integrations/snapchat/report?${query}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل التقرير')
      setReport(data); setError(''); setLoadedKey(key)
    }).catch(err => { if (!controller.signal.aborted) { setError(err.message); setLoadedKey(key) } })
    return () => controller.abort()
  }, [account, days, revision, key])

  async function saveCosts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true)
    const fields = new FormData(event.currentTarget)
    const values = Object.fromEntries(costFields.map(([name]) => [name, fields.get(name) === '' ? null : Number(fields.get(name))]))
    try {
      const response = await fetch('/api/admin/integrations/snapchat/costs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      if (!response.ok) throw new Error('تعذر حفظ التكاليف؛ راجع الأرقام والصلاحيات')
      setRevision(value => value + 1)
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر الحفظ') }
    finally { setSaving(false) }
  }

  function adLink(content: string) {
    const query = new URLSearchParams({ utm_source: 'snapchat', utm_medium: 'paid_social', utm_campaign: 'rwnak_purchase_test_01', utm_content: content, utm_term: report!.account.id })
    return `https://www.rwnak.net/?${query}`
  }
  async function copyLink(content: string) {
    try { await navigator.clipboard.writeText(adLink(content)); setCopied(content) }
    catch { setError('تعذر النسخ التلقائي؛ انسخ رابط الإعلان الظاهر يدوياً') }
  }
  const price = report?.product ? `${n(Number(report.product.product_price), 3)} ${report.product.product_currency === 'KWD' ? 'دك' : report.product.product_currency}` : 'السعر الموضح بالموقع'
  const drafts = [
    { id: 'clear_instructions', title: '١. كل مرة تعيدين الشرح؟', hook: 'تقولين لها «رتّبي المطبخ»… بس شنو المطلوب بالضبط؟', shots: '٠–٣ ثوانٍ: مطبخ مرتب جزئياً وعنوان السؤال. ٣–٨: صفحة فعلية من الدليل توضح ترتيب الخطوات. ٨–١٢: قائمة متابعة واضحة على آيباد. ١٢–١٥: غلاف الدليل والسعر والرابط.', text: `بدل التعليمات العامة، خلي المهام والخطوات واضحة جدامها. دليل رونق PDF لتدريب العاملة وتنظيم البيت، بـ${price}. اختاري اللغة المناسبة وحمّليه عقب الدفع.` },
    { id: 'inside_the_guide', title: '٢. شنو داخل الدليل؟', hook: 'قبل تشترينه… شوفي شنو داخله 👀', shots: '٠–٣: الغلاف الحقيقي على آيباد. ٣–٩: تمرير على مهمة فعلية، جدول يومي، وجدول أسبوعي. ٩–١٢: أمثلة حقيقية للغات المتاحة. ١٢–١٥: السعر ودعوة الشراء.', text: `٦٦ مهمة، وخطوات لكل غرفة، وقوائم يومية وأسبوعية وشهرية. تختارين لغة وحدة من خمس لغات عند الشراء. PDF بتحميل فوري، دفعة وحدة بـ${price}.` },
    { id: 'use_it_today', title: '٣. طريقة الاستخدام', hook: 'شلون تستخدمين رونق أول يوم؟', shots: '٠–٣: صفحة مهمة حقيقية. ٣–٩: تحديد غرفة، قراءة الخطوات، ثم علامة إنجاز على جدول فعلي. ٩–١٢: لقطة للجدول بعد تنظيمه. ١٢–١٥: الغلاف والسعر والرابط.', text: `اختاري مهمة من الدليل، خلي العاملة تتبع خطواتها، وراجعي وياها النتيجة من قائمة المتابعة. تنظيم واضح بدل الشرح كل مرة. دليل رونق بـ${price}.` },
  ]
  return <main dir="rtl" className={styles.page}>
    <header className={styles.header}><div><Link href="/admin/snapchat">← حالة ربط سناب</Link><h1>أداء سناب رونق</h1><p>إنفاق الإعلان، مبيعات الموقع، وحالة قياس الشراء.</p></div>
      <button className={styles.button} onClick={() => setRevision(value => value + 1)} disabled={loading}>تحديث الأرقام</button></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading && <p role="status">جاري قراءة الأرقام من سناب والموقع…</p>}
    {report && <>
      <section className={styles.panel} aria-label="فترة التقرير"><div className={styles.filters}>
        <label>الحساب الإعلاني<select value={account || report.account.id} onChange={event => setAccount(event.target.value)} disabled={loading}>{report.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>الفترة<select value={days} onChange={event => setDays(Number(event.target.value))} disabled={loading}><option value={1}>أمس</option><option value={7}>آخر ٧ أيام مكتملة</option><option value={30}>آخر ٣٠ يوم مكتمل</option></select></label>
      </div><p>من {date(report.range.start)} إلى ما قبل {date(report.range.end)} — بتوقيت الكويت. تم التحديث {new Date(report.generatedAt).toLocaleString('ar-KW', { timeZone: 'Asia/Kuwait' })}.</p>
      <p className={styles.note}>الإنفاق والقيمة التالية بعملة الحساب ({report.account.currency}). إسناد سناب: ٧ أيام بعد الضغط ويوم بعد المشاهدة، بحسب وقت التحويل. الأرقام الحديثة قابلة للتعديل وليست كشف تسوية بنكي.</p></section>
      <section className={styles.metrics} aria-label="نتائج سناب">
        <Metric label="إنفاق سناب" value={`${n(report.amounts.spend, 2)} ${report.account.currency}`} />
        <Metric label="مشتريات ينسبها سناب" value={n(report.metrics.conversion_purchases)} />
        <Metric label="قيمة مشتريات ينسبها سناب" value={`${n(report.amounts.purchaseValue, 2)} ${report.account.currency}`} />
        <Metric label="تكلفة الشراء حسب سناب" value={report.amounts.costPerPurchase === null ? 'غير محسوبة' : `${n(report.amounts.costPerPurchase, 2)} ${report.account.currency}`} />
        <Metric label="العائد على الإنفاق حسب سناب" value={report.amounts.roas === null ? 'غير محسوب' : `${n(report.amounts.roas, 2)}×`} />
        <Metric label="الظهور / الضغطات" value={`${n(report.metrics.impressions)} / ${n(report.metrics.swipes)}`} />
      </section>
      <section className={styles.panel}><h2>الطلبات المدفوعة بالموقع</h2><div className={styles.metrics}>
        <Metric label="طلبات الموقع من كل المصادر" value={n(report.website.sitePaidOrders)} />
        <Metric label="إيراد الموقع من كل المصادر" value={Object.entries(report.website.siteRevenue).map(([currency, amount]) => `${n(amount, 3)} ${currency}`).join(' / ') || 'لا توجد طلبات مدفوعة بالفترة'} />
        <Metric label="طلبات تحمل رابط سناب المدفوع لهذا الحساب" value={n(report.website.taggedOrders)} />
        <Metric label="إيراد الطلبات المرصودة لهذا الحساب" value={`${n(report.website.taggedRevenueKwd, 3)} دك`} />
      </div><p className={styles.note}>مبيعات الموقع الإجمالية لا تُنسب تلقائياً لسناب. رصد روابط الإعلانات يبدأ من تفعيل هاللوحة، ويحتاج موافقة الزائر. قد تفوتنا طلبات؛ لذلك لا نقارن عدد سناب بعدد الموقع كأنهم نفس القياس.</p></section>
      <section className={styles.panel}><h2>تأكيد حدث الشراء الحقيقي</h2><p className={report.verification.verified ? styles.success : styles.warning}>{report.verification.verified ? 'وصل حدث شراء مدفوع من السيرفر بعد تحديث التتبّع.' : 'باقي اختبار طلب مدفوع حقيقي بعد تحديث التتبّع؛ الربط وحده لا يؤكد حدث الشراء.'}</p>
        {report.verification.latest && <p>آخر إرسال مؤكد: {new Date(report.verification.latest.sentAt).toLocaleString('ar-KW', { timeZone: 'Asia/Kuwait' })} — {report.verification.latest.amount} {report.verification.latest.currency}.</p>}
        <p className={styles.note}>{report.verification.note}</p></section>
      <section className={styles.panel}><h2>الحملات خلال الفترة</h2>{!report.campaignsComplete && <p className={styles.warning}>تفاصيل الحملات غير مكتملة؛ لا تستنتج أن الحملات بلا إنفاق من الجدول.</p>}
        <div className={styles.tableWrap}><table><thead><tr><th>الحملة</th><th>الإنفاق {report.account.currency}</th><th>الظهور</th><th>الضغطات</th><th>المشتريات المنسوبة</th><th>تكلفة الشراء</th></tr></thead><tbody>{report.campaigns.map(item => <tr key={item.id}><td>{item.name}</td><td>{n(item.amounts.spend, 2)}</td><td>{n(item.metrics.impressions)}</td><td>{n(item.metrics.swipes)}</td><td>{n(item.metrics.conversion_purchases)}</td><td>{n(item.amounts.costPerPurchase, 2)}</td></tr>)}</tbody></table></div>
        {!report.campaigns.length && report.campaignsComplete && <p>لم يرجع سناب حملات للفترة المختارة.</p>}</section>
      <section className={styles.panel}><h2>نموذج التكاليف</h2><p>أدخل الأرقام من عقد بوابة الدفع وتسوية البنك. اترك أي تكلفة مجهولة فارغة؛ الصفر يعني أنك أكدت عدم وجودها.</p>
        <form key={report.generatedAt} onSubmit={saveCosts}><div className={styles.costs}>{costFields.map(([name, label]) => <label key={name}>{label}<input name={name} type="number" min={name === 'usd_kwd_rate' ? '0.000001' : '0'} max={name === 'payment_fee_percent' ? '100' : name === 'usd_kwd_rate' ? '10' : '100000'} step="any" defaultValue={report.costs[name] ?? ''} placeholder="غير معروف" /></label>)}</div><button disabled={saving || loading} className={styles.button}>{saving ? 'جاري الحفظ…' : 'حفظ نموذج التكاليف'}</button></form>
        <h3>فائض المبيعات المرصودة بعد التكاليف المقدّرة</h3><p className={styles.margin}>{report.margin.estimateKwd === null ? 'غير محسوب — بيانات التكاليف أو تحويل العملة ناقصة' : `${n(report.margin.estimateKwd, 3)} دك`}</p>
        <p className={styles.note}>هذا تقدير يخص الطلبات التي رصدنا مصدرها، ويشمل نموذج الرسوم والتكاليف اليومية المدخل. لا يمثل صافي ربح محاسبياً نهائياً؛ يحتاج مطابقة الاسترجاعات والتسويات والتكاليف الفعلية.</p></section>
      <section className={styles.panel}><h2>تجربة الإعلان المجهّزة</h2><p>الحد المقترح المعتمد: ٦ دك باليوم لمدة ٧ أيام، بإجمالي ٤٢ دك وضمن سقف شهر ٢٠٠ دك. الميزانية للمجموعة كلها. يبدأ التنفيذ بعد تأكيد شراء حقيقي وتجهيز اللقطات النهائية.</p>
        <p className={styles.note}>المواصفات: عمودي ١٠٨٠×١٩٢٠، ١٥ ثانية، Tajawal Bold، بنفسجي ونعناعي، شعار رونق الأصلي، لقطات فعلية من الدليل، بدون وجوه أو أيدٍ، وبدون موسيقى.</p>
        <div className={styles.drafts}>{drafts.map(draft => <article key={draft.id}><h3>{draft.title}</h3><strong>{draft.hook}</strong><p>{draft.shots}</p><p>{draft.text}</p><p className={styles.note}>مسودة نص ولقطات؛ ليست إعلاناً منشوراً أو ملف فيديو نهائياً.</p><button className={styles.secondary} onClick={() => void copyLink(draft.id)}>{copied === draft.id ? 'تم نسخ الرابط' : 'نسخ رابط قياس هالإعلان'}</button><details><summary>عرض الرابط</summary><code dir="ltr">{adLink(draft.id)}</code></details></article>)}</div>
      </section>
    </>}
  </main>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>
}
