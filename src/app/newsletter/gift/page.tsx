import Link from 'next/link'
import type { Metadata } from 'next'
export const metadata: Metadata = {title:'جدول التنظيف الأسبوعي المجاني',robots:{index:false,follow:false}}
const days=['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة']
export default function WeeklyPlanner() {
 return <main className="weekly-planner" dir="rtl"><p className="planner-brand">رَوْنَق · هديتج لتنظيم البيت</p><h1>جدول تنظيف يناسب بيتج</h1><p>اكتبي مهمة إضافية واحدة لكل يوم حسب استخدام البيت. خلّي وقت للراحة، وعدّلي الجدول مع العاملة إذا احتاج.</p><div className="planner-notes">روتين يومي مقترح: ترتيب المساحات المستخدمة · أدوات المطبخ بعد الاستخدام · تفقد السلال والحمامات حسب الحاجة.</div><table><caption>الأسبوع من: __________ إلى: __________</caption><thead><tr><th>اليوم</th><th>المهمة الإضافية / المكان</th><th>تم ✓ / تأجل</th></tr></thead><tbody>{days.map(day=><tr key={day}><th scope="row">{day}</th><td>____________________</td><td>________</td></tr>)}</tbody></table><p>ملاحظات ومتابعة: __________________________________________________</p><p>اتبعي تعليمات الأسطح والأجهزة والمنظفات، ولا تخلطين مواد التنظيف. هالجدول المجاني مستقل عن دليل رونق المدفوع.</p><p className="planner-help">للطباعة أو الحفظ PDF، اختاري «طباعة» من قائمة المتصفح، ثم «حفظ كملف PDF».</p><Link className="planner-back" href="/">تعرّفي على دليل رونق</Link></main>
}
