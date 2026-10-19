import { BrandLogo } from './BrandLogo'
import { PreviewZoom } from './PreviewZoom'

const cloths = [
  ['أحمر', '#D74444', 'الحمّام والمراحيض فقط'],
  ['أزرق', '#2376C8', 'الزجاج والمرايا'],
  ['أصفر', '#F2C543', 'أسطح الغرف، الأثاث، الرفوف'],
  ['أخضر', '#79AC48', 'أسطح المطبخ والحوض'],
  ['أبيض / رمادي', '#D3D5DA', 'الأرضيات والممسحة'],
]

function ClothPage() {
  return <div className="guide-sample-page" dir="rtl" lang="ar">
    <div className="sample-page-header"><BrandLogo compact /><span>الفصل الأول · القواعد</span></div>
    <h4>نظام ألوان الأقمشة</h4>
    <p>٥ ألوان أقمشة — ٥ مناطق. لا تخلطيها أبداً. هذا النظام يمنع انتقال الجراثيم من الحمّام للمطبخ.</p>
    <table className="sample-cloth-table"><caption className="sr-only">لون القماش والمنطقة المخصصة له</caption><thead className="sr-only"><tr><th scope="col">اللون</th><th scope="col">الاستخدام</th></tr></thead><tbody>{cloths.map(([name, color, usage]) => <tr key={name}><th scope="row"><span className="cloth-dot" style={{ background: color }} aria-hidden="true" />{name}</th><td>{usage}</td></tr>)}</tbody></table>
    <p className="sample-note">إذا لم يكن في المنزل أقمشة ملوّنة، خصّصي قطعة لكل منطقة واحتفظي بها في أكياس منفصلة.</p>
    <div className="sample-page-footer">مقتطف من النسخة العربية · أعيد تنسيقه للمعاينة</div>
  </div>
}

function GuestPage() {
  return <div className="guide-sample-page" dir="rtl" lang="ar">
    <div className="sample-page-header"><BrandLogo compact /><span>الفصل الأول · القواعد</span></div>
    <h4>نظرة الضيف</h4>
    <p>قبل مغادرة أي غرفة، توقّفي عند الباب. انظري للغرفة كأنكِ ترينها لأول مرة. اسألي نفسكِ: هل تبدو نظيفة، مرتّبة، ومنعشة؟</p>
    <p>هذا الفحص بـ ١٠ ثوانٍ يكشف ما فاتكِ — بصمة أصابع على المرآة، وسادة غير مستقيمة، سلّة مهملات لم تُفرّغ.</p>
    <aside className="sample-reminder"><strong>تذكّري</strong><p>لا تتخطّي هذه الخطوة أبداً.</p></aside>
    <h4>الخصوصية والاحترام</h4>
    <ul className="sample-respect-list">
      <li>اطرقي الباب قبل دخول أي غرفة. انتظري الإذن.</li>
      <li>لا تفتحي الأدراج أو الحقائب أو الخزانات إلا إذا طُلب منكِ ذلك.</li>
      <li>إذا وجدتِ أموالاً أو مجوهرات أو أشياء ثمينة — لا تلمسيها. أخبري صاحبة المنزل فوراً.</li>
      <li>لا تشاركي أي معلومات تخصّ الأسرة مع أحد خارج المنزل.</li>
      <li>أعيدي كل شيء لمكانه بالضبط كما وجدتِه.</li>
    </ul>
    <div className="sample-page-footer">مقتطف من النسخة العربية · أعيد تنسيقه للمعاينة</div>
  </div>
}

const previews = [
  { title: 'نظام ألوان الأقمشة', description: 'مثال يوضّح للعاملة أي فوطة تستخدم لكل منطقة في البيت.', Page: ClothPage },
  { title: 'نظرة الضيف والخصوصية', description: 'خطوات لمراجعة ترتيب الغرفة واحترام خصوصية أهل البيت.', Page: GuestPage },
]

export function GuidePreviews() {
  return <section className="guide-previews" aria-labelledby="preview-heading">
    <div className="preview-section-label">من داخل الدليل</div>
    <h3 id="preview-heading">شوفي طريقة الشرح قبل الشراء</h3>
    <p className="preview-intro">مقتطفان من النسخة العربية، أعدنا تنسيقهم للقراءة على الجوال. تقدرين تكبّرين كل معاينة.</p>
    <div className="guide-preview-grid">{previews.map(({ title, description, Page }) => <article className="guide-preview-card" key={title}>
      <div className="sample-thumbnail"><Page /></div>
      <div className="preview-card-details"><h4>{title}</h4><p>{description}</p><PreviewZoom title={title}><Page /></PreviewZoom></div>
    </article>)}</div>
  </section>
}
