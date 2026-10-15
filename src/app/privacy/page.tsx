import type { Metadata } from 'next'
import { getPage, pageMetadata } from '@/lib/content'
import { getStoreSettings } from '@/lib/store-settings'
import { LegalPage } from '@/components/sections/LegalPage'

// Force per-request rendering so admin edits to this page's content/store
// settings are never stuck behind a stale build-time snapshot — see the
// detailed comment on this same export in src/app/page.tsx.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(await getPage('privacy'))
}

export default async function PrivacyPage() {
  const [page, settings] = await Promise.all([getPage('privacy'), getStoreSettings()])
  page.content += '\n\nقياس إعلانات سناب: بعد موافقتك الاختيارية، نستخدم Snap Pixel وConversions API لقياس الزيارات والمشتريات وتحسين الإعلانات. قد نشارك مع Snap نشاط التصفح وقيمة الشراء والعملة ومعرّفات الإعلان والمتصفح، والبريد الإلكتروني أو رقم الهاتف عند توفره بعد التجزئة للمطابقة. التجزئة لا تجعل البيانات مجهولة بالكامل. لا نرسل بيانات البطاقة أو كلمات المرور. يمكنك الرفض أو تغيير اختيارك من زر «خصوصية سناب»؛ الرفض لا يمنع الشراء. سحب الموافقة يوقف الإرسال المستقبلي، ولا يسترجع البيانات التي أُرسلت بالفعل.\n\nتُحفظ تفضيلات سناب لمدة تصل إلى 180 يوماً، ومعرّف النقرة لمدة تصل إلى 30 يوماً. تحتفظ سجلات الربط الداخلية بمعرّف الطلب وإثبات الموافقة وحالة الإرسال؛ تُمسح معرّفات المتصفح من قائمة الإرسال بعد نجاحه.'
  return <LegalPage page={page} settings={settings} />
}
