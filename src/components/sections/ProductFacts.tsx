import type { StoreSettings } from '@/lib/store-settings'
import { arabicNumber } from '@/lib/display'
import type { BookLanguage } from '@/types'

// Server-rendered, visible product facts; price and available languages always
// come from the same source as checkout. No hidden AI-only sales copy.
export function ProductFacts({ settings, languages, faqs = [], compact = false, includeContents = true }: { settings: StoreSettings; languages: BookLanguage[]; faqs?: {question:string;answer:string}[]; compact?: boolean; includeContents?: boolean }) {
  const price = `${arabicNumber(settings.product_price)} د.ك`
  const facts = [
    ['هل رونق برنامج أو اشتراك؟', 'رونق دليل رقمي بصيغة PDF لتدريب العاملة وتنظيم تنظيف البيت، تقرينه على الجهاز أو تطبعينه للاستخدام داخل بيتج. مو تطبيق ولا دورة حضورية.'],
    ['شنو يشمل الدليل؟', 'خطوات تنظيف غرفة بغرفة، وقوائم متابعة، وجداول يومية وأسبوعية وشهرية تساعدج على شرح المهام ومراجعتها.'],
    ['شلون أختار اللغة؟', languages.length ? `اللغات المتاحة حالياً: ${languages.map(language => language.name_ar).join('، ')}. تختارين لغة واحدة عند الشراء؛ الطلب ما يشمل كل اللغات مع بعض.` : 'اختاري لغة واحدة من اللغات المتاحة في صفحة الشراء. الطلب يشمل نسخة باللغة المختارة.'],
    ['جم سعره وشلون أستلمه؟', `السعر الحالي ${price}، دفعة واحدة بدون اشتراك شهري. بعد تأكيد الدفع يتاح التحميل، وينرسل رابط الاستلام إلى الإيميل المستخدم بالشراء. ما تحتاجين تنشئين حساب قبل الدفع.`],
  ]
  facts.push(['شلون أرجع لدليلي؟', 'بعد تأكيد الدفع يوصلك رابط الاستلام على إيميل الشراء. وإذا عندج حساب، افتحي مكتبتي لمراجعة مشترياتج المرتبطة بالحساب.'])
  const extra = faqs.filter(f => !/أستلم|استلم|لغة|لغات|اشتراك|حساب/.test(f.question)).map(f => [f.question.replace(/الكتاب/g,'الدليل'), f.answer.replace(/الكتاب/g,'الدليل')])
  facts.push(...extra)
  if (!includeContents) facts.splice(1, 1)
  if (compact) return <div className="compact-faq">{facts.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}<p><a href="/library">مكتبتي</a> · <a href="/refund">سياسة الاستلام والاسترجاع</a></p></div>
  return <dl style={{margin:0}}>{facts.map(([question, answer]) => <div key={question} style={{padding:'16px 0',borderBottom:'1px solid #EDE8F5'}}><dt style={{fontWeight:900,color:'#26215C',marginBottom:8}}>{question}</dt><dd style={{margin:0,color:'#4A4060',lineHeight:1.9,fontSize:15}}>{answer}</dd></div>)}</dl>
}
