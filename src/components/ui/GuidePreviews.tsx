import { BrandLogo } from './BrandLogo'
import { PreviewZoom } from './PreviewZoom'

const cloths = [
  ['أحمر', '#D74444', 'الحمّام والمراحيض فقط'],
  ['أزرق', '#2376C8', 'الزجاج والمرايا'],
  ['أصفر', '#F2C543', 'أسطح الغرف، الأثاث، الرفوف'],
  ['أخضر', '#79AC48', 'أسطح المطبخ والحوض'],
  ['أبيض / رمادي', '#D3D5DA', 'الأرضيات والممسحة'],
]

function ClothPage({ compact = false }: { compact?: boolean }) {
  return <div className={`guide-sample-page${compact ? ' sample-excerpt' : ''}`} dir="rtl" lang="ar">
    {!compact && <><div className="sample-page-header"><BrandLogo compact /><span>الفصل الأول · القواعد</span></div><h3>نظام ألوان الأقمشة</h3></>}
    <p>{compact ? '٥ ألوان أقمشة — ٥ مناطق. لا تخلطيها أبداً.' : '٥ ألوان أقمشة — ٥ مناطق. لا تخلطيها أبداً. هذا النظام يمنع انتقال الجراثيم من الحمّام للمطبخ.'}</p>
    <table className="sample-cloth-table"><caption className="sr-only">لون القماش والمنطقة المخصصة له</caption><thead className="sr-only"><tr><th scope="col">اللون</th><th scope="col">الاستخدام</th></tr></thead><tbody>{cloths.map(([name, color, usage]) => <tr key={name}><th scope="row"><span className="cloth-dot" style={{ background: color }} aria-hidden="true" />{name}</th><td>{usage}</td></tr>)}</tbody></table>
    {!compact && <><p className="sample-note">إذا لم يكن في المنزل أقمشة ملوّنة، خصّصي قطعة لكل منطقة واحتفظي بها في أكياس منفصلة.</p><div className="sample-page-footer">مقتطف من النسخة العربية · أعيد تنسيقه للمعاينة</div></>}
  </div>
}

function GuestPage({ compact = false }: { compact?: boolean }) {
  if (compact) return <div className="guide-sample-page sample-excerpt" dir="rtl" lang="ar">
    <p>قبل مغادرة أي غرفة، توقّفي عند الباب. انظري للغرفة كأنكِ ترينها لأول مرة.</p>
    <p>هل تبدو نظيفة، مرتّبة، ومنعشة؟</p>
    <h4>الخصوصية والاحترام</h4>
    <ul className="sample-respect-list"><li>اطرقي الباب قبل دخول أي غرفة. انتظري الإذن.</li><li>لا تفتحي الأدراج أو الحقائب أو الخزانات إلا إذا طُلب منكِ ذلك.</li></ul>
  </div>
  return <div className="guide-sample-page" dir="rtl" lang="ar">
    <div className="sample-page-header"><BrandLogo compact /><span>الفصل الأول · القواعد</span></div>
    <h3>نظرة الضيف</h3>
    <p>قبل مغادرة أي غرفة، توقّفي عند الباب. انظري للغرفة كأنكِ ترينها لأول مرة. اسألي نفسكِ: هل تبدو نظيفة، مرتّبة، ومنعشة؟</p>
    <p>هذا الفحص بـ ١٠ ثوانٍ يكشف ما فاتكِ — بصمة أصابع على المرآة، وسادة غير مستقيمة، سلّة مهملات لم تُفرّغ.</p>
    <aside className="sample-reminder"><strong>تذكّري</strong><p>لا تتخطّي هذه الخطوة أبداً.</p></aside>
    <h3>الخصوصية والاحترام</h3>
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
    <h2 id="preview-heading">شوفي طريقة الشرح قبل الشراء</h2>
    <p className="preview-intro"><span className="preview-swipe-hint">اسحبي بين المعاينات. </span>مقتطفان من النسخة العربية، أعدنا تنسيقهم للقراءة. افتحي المعاينة لقراءة المزيد.</p>
    <div className="guide-preview-grid">{previews.map(({ title, description, Page }) => <article className="guide-preview-card" key={title}>
      <h3 className="preview-card-title">{title}</h3>
      <div className="sample-thumbnail"><Page compact /></div>
      <div className="preview-card-details"><p>{description}</p><PreviewZoom title={title}><Page /></PreviewZoom></div>
    </article>)}</div>
  </section>
}
