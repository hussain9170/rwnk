'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { CardBrandsIcon, KnetIcon, ApplePayIcon } from '@/components/ui/PaymentIcons'
import { type StoreSettings } from '@/lib/store-settings'
import type { BookLanguage } from '@/types'
import { isValidEmail } from '@/lib/validation'
import { trackViewItem, trackSelectLanguage, trackBeginCheckout, trackAddPaymentInfo } from '@/lib/gtag'
import { hasSnapConsent } from '@/lib/snap-consent'

const P='#6747B2',PL='#EDE8FF',T1='#1A1228',T2='#4A4060',T3='#6B617E',BR='#EDE8F5'
const PM=[
  {id:'card',Icon:CardBrandsIcon,label:'بطاقة ائتمان'},
  {id:'knet',Icon:KnetIcon,label:'KNET'},
  {id:'apple',Icon:ApplePayIcon,label:'Apple Pay'},
]

const ERROR_MESSAGES: Record<string, string> = {
  payment_failed:   'لم تكتمل عملية الدفع أو تم إلغاؤها. يمكنك المحاولة مرة أخرى.',
  missing_purchase: 'انتهت صلاحية جلسة الدفع، يرجى إعادة المحاولة.',
  callback_error:   'حدث خطأ أثناء تأكيد الدفع. إذا تم خصم المبلغ تواصلي معنا فوراً.',
}

export default function CheckoutForm({ settings, languages }: { settings: StoreSettings; languages: BookLanguage[] }) {
  const pm = 'gateway'
  const [bookLanguage,setBookLanguage]=useState(() => languages.some(l => l.language_code === 'ar') ? 'ar' : (languages[0]?.language_code ?? ''))
  const [email,setEmail]=useState('')
  const [customerName,setCustomerName]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [banner,setBanner]=useState('')
  const submitting = useRef(false)

  useEffect(() => {
    function init() {
      trackViewItem({ item_id: settings.product_id, item_name: settings.product_name, price: settings.product_price }, settings.product_currency)
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error')
      if (err) setBanner(ERROR_MESSAGES[err] ?? 'تعذّر إتمام عملية الدفع. حاولي مرة أخرى.')
    }
    init()
  }, [settings])

  const focus=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=P;e.target.style.boxShadow='0 0 0 3px rgba(103,71,178,.1)'}
  const blur=(e:React.FocusEvent<HTMLInputElement>)=>{e.target.style.borderColor=BR;e.target.style.boxShadow='none'}
  const inp:React.CSSProperties={width:'100%',height:48,background:'#FAFAFA',border:`1px solid ${BR}`,borderRadius:10,padding:'0 12px',fontSize:16,color:T1,outline:'none',fontFamily:"var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif",transition:'all .2s'}

  async function handlePay(){
    if (submitting.current || loading) return
    if (!languages.some(l => l.language_code === bookLanguage)) { setBanner('لا توجد نسخة جاهزة للبيع حالياً. تواصلي معنا للمساعدة.'); return }
    if (!email) { setError('يرجى إدخال البريد الإلكتروني'); document.getElementById('checkout-email')?.focus(); return }
    if (!isValidEmail(email)) { setError('صيغة البريد الإلكتروني غير صحيحة'); document.getElementById('checkout-email')?.focus(); return }

    submitting.current = true
    setLoading(true); setError(''); setBanner('')

    const item = { item_id: settings.product_id, item_name: settings.product_name, price: settings.product_price, book_language: bookLanguage }
    trackBeginCheckout(item, settings.product_currency)
    if (hasSnapConsent() && window.snaptr?.handleRequest) window.snaptr('track', 'START_CHECKOUT', { currency: settings.product_currency, price: settings.product_price })

    try {
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, customerName, paymentMethod: pm, bookLanguage, expectedPrice: settings.product_price }),
      })
      const checkoutJson = await checkoutRes.json()
      if (!checkoutRes.ok) throw new Error(checkoutJson.error ?? 'تعذّر إنشاء الطلب')

      const payRes = await fetch('/api/payment/initiate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: checkoutJson.purchaseId, access: checkoutJson.access }),
      })
      const payJson = await payRes.json()
      if (!payRes.ok || !payJson.paymentUrl) throw new Error(payJson.error ?? 'تعذّر بدء عملية الدفع')

      trackAddPaymentInfo(item, settings.product_currency, pm)
      window.location.href = payJson.paymentUrl
    } catch (err: any) {
      setError(err.message ?? 'حدث خطأ غير متوقع، حاولي مرة أخرى')
      submitting.current = false
      setLoading(false)
    }
  }

  const price = settings.product_price
  const priceLabel = `${price} د.ك`

  return (
    <main className="checkout-shell" style={{width:'100%',maxWidth:1120,margin:'0 auto',minHeight:'100vh',display:'grid',gridTemplateColumns:'minmax(0,1fr) 350px',fontFamily:"var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif",direction:'rtl',background:'#fff'}}>
      <div className="checkout-col-main" style={{overflowY:'auto',padding:'clamp(20px,5vw,32px) clamp(16px,5vw,40px)',backgroundImage:'radial-gradient(circle,rgba(103,71,178,0.04) 1px,transparent 1px)',backgroundSize:'28px 28px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28,flexWrap:'wrap',gap:8}}>
          <Link href="/" aria-label="رَوْنَق — الرئيسية" style={{display:'flex',alignItems:'center',color:T1,textDecoration:'none'}}>
            <BrandLogo compact />
          </Link>
          <span style={{fontSize:12,color:T3}}>دفع آمن ومشفّر</span>
        </div>
        <h1 style={{fontSize:24,fontWeight:900,marginBottom:4,color:T1}}>إتمام الشراء</h1>
        <p style={{fontSize:13,color:T3,marginBottom:24}}>لا حاجة لإنشاء حساب — ادفعي واستلمي فوراً</p>

        {banner && (
          <div role="alert" style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#A32D2D',lineHeight:1.6}}>
            {banner}
          </div>
        )}

        <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:16,padding:20,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:900,color:P,textTransform:'uppercase',marginBottom:14}}>لغة الكتاب</div>
          <p style={{fontSize:14,color:T2,lineHeight:1.8,marginBottom:14}}>يشمل الطلب نسخة واحدة باللغة المختارة بسعر {priceLabel}، وليس جميع اللغات.</p>
          <div className="checkout-lang-grid" role="radiogroup" aria-label="لغة الكتاب" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8}}>
            {languages.map(l=>(
              <button key={l.language_code} type="button" role="radio" aria-checked={bookLanguage===l.language_code} tabIndex={bookLanguage===l.language_code?0:-1} onKeyDown={e=>{
                const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']; if(!keys.includes(e.key)) return; e.preventDefault();
                const i=languages.findIndex(x=>x.language_code===bookLanguage);
                const next=e.key==='Home'?0:e.key==='End'?languages.length-1:(i+(['ArrowLeft','ArrowDown'].includes(e.key)?1:-1)+languages.length)%languages.length;
                setBookLanguage(languages[next].language_code); trackSelectLanguage(languages[next].language_code);
                e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
              }} onClick={()=>{setBookLanguage(l.language_code); trackSelectLanguage(l.language_code)}}
                style={{minHeight:52,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,border:`1.5px solid ${bookLanguage===l.language_code?P:BR}`,background:bookLanguage===l.language_code?PL:'#fff',borderRadius:10,cursor:'pointer',fontFamily:"var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif",transition:'all .15s',padding:'6px 8px'}}>
                <span style={{fontSize:13,fontWeight:700,color:bookLanguage===l.language_code?P:T2}}>{l.name_ar}</span>
                <span style={{fontSize:12,color:bookLanguage===l.language_code?P:T3}}>{l.name_en}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:16,padding:20,marginBottom:14}}>
          <label htmlFor="checkout-email" style={{display:'block',fontSize:12,fontWeight:900,color:P,textTransform:'uppercase',marginBottom:14}}>بريدك الإلكتروني</label>
          <input id="checkout-email" type="email" placeholder="example@email.com" dir="ltr" autoComplete="email" required
            value={email} onChange={e=>{setEmail(e.target.value); if(error) setError('')}} onFocus={focus} onBlur={blur}
            aria-invalid={!!error} aria-describedby={error?'checkout-email-error':undefined}
            style={inp}/>
          <p style={{fontSize:12,color:T3,marginTop:6}}>سيُرسل الكتاب لهذا البريد · سيُنشأ حسابك تلقائياً بعد الدفع</p>
          {error && <p id="checkout-email-error" role="alert" style={{fontSize:12,color:'#A32D2D',marginTop:8,padding:'8px 12px',background:'#FEF2F2',borderRadius:8}}>{error}</p>}

          <label htmlFor="checkout-name" style={{display:'block',fontSize:12,fontWeight:900,color:P,textTransform:'uppercase',margin:'16px 0 14px'}}>الاسم <span style={{fontWeight:400,color:T3,textTransform:'none'}}>(اختياري)</span></label>
          <input id="checkout-name" type="text" placeholder="اسمك الكامل" autoComplete="name"
            value={customerName} onChange={e=>setCustomerName(e.target.value)} onFocus={focus} onBlur={blur}
            style={inp}/>
        </div>

        <div style={{background:'#fff',border:`1px solid ${BR}`,borderRadius:16,padding:20}}>
          <div style={{fontSize:12,fontWeight:900,color:P,textTransform:'uppercase',marginBottom:14}}>طريقة الدفع</div>
          <div className="checkout-pm-grid" aria-label="وسائل الدفع المتاحة لدى البوابة" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
            {PM.map(m=>(
              <div key={m.id}
                style={{minHeight:44,border:`1.5px solid ${BR}`,background:'#fff',borderRadius:10,padding:'10px 8px',textAlign:'center',fontFamily:"var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif"}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:32,marginBottom:6,direction:'ltr'}}><m.Icon height={28} /></div>
                <div style={{fontSize:12,fontWeight:700,color:T2}}>{m.label}</div>
              </div>
            ))}
          </div>
          <p style={{fontSize:14,color:T2,lineHeight:1.8}}>اختاري وسيلة الدفع في الخطوة التالية داخل بوابة الدفع.</p>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 4px',fontSize:12,color:T3,lineHeight:1.6}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            سيتم تحويلك إلى صفحة دفع آمنة تابعة لبوابة الدفع لإدخال بيانات البطاقة — لا نقوم بتخزين بيانات بطاقتك على موقعنا.
          </div>
        </div>
      </div>

      <div className="checkout-col-summary" style={{background:'#FAFAFA',borderRight:`1px solid ${BR}`,display:'flex',flexDirection:'column',padding:'clamp(20px,5vw,28px)',overflowY:'auto'}}>
        <div style={{fontSize:14,fontWeight:900,color:T1,marginBottom:18}}>ملخص الطلب</div>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:12,background:PL,borderRadius:12,marginBottom:18}}>
          <Image src="/rwnak-guide-cover-ar.webp" alt="غلاف النسخة العربية من دليل رونق" width={46} height={66} sizes="46px" style={{width:46,height:66,borderRadius:5,flexShrink:0,objectFit:'cover'}} />
          <div>
            <div style={{fontSize:13,fontWeight:900,color:T1,marginBottom:2}}>{settings.product_name}</div>
            <div style={{fontSize:12,color:T3,display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
              دليل التنظيف — PDF
              <span style={{display:'inline-flex',alignItems:'center',gap:3,fontWeight:700,color:P,background:'#fff',padding:'1px 7px',borderRadius:999,border:`1px solid ${BR}`}}>
                {languages.find(l=>l.language_code===bookLanguage)?.name_ar ?? bookLanguage}
              </span>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:P,marginTop:6}}>تحميل بعد تأكيد الدفع</div>
          </div>
        </div>
        <p style={{fontSize:14,color:T2,lineHeight:1.8,marginBottom:18}}>تقدرين تحمّلين نفس ملف الدليل حتى {settings.downloads_limit} مرات إجمالاً، باللغة اللي اخترتيها. الطلب يشمل نسخة بلغة واحدة.</p>
        <div style={{borderTop:`1px solid ${BR}`,paddingTop:14,marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:9}}>
            <span style={{color:T3}}>سعر الكتاب</span>
            <span style={{display:'flex',alignItems:'baseline',gap:6}}>
              <span style={{fontWeight:700,color:T3,textDecoration:'line-through',fontSize:12}}>{settings.product_original_price} د.ك</span>
              <span style={{fontWeight:900,color:P}}>{priceLabel}</span>
            </span>
          </div>
          <p style={{fontSize:13,color:T2,lineHeight:1.8}}>منتج رقمي — لا يوجد شحن ورقي.</p>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderTop:`1px solid ${BR}`,marginBottom:20}}>
          <span style={{fontSize:14,fontWeight:900,color:T1}}>الإجمالي</span>
          <span style={{fontSize:26,fontWeight:900,color:P,letterSpacing:-0.5}}>{price} <span style={{fontSize:13,fontWeight:400,color:T3,letterSpacing:'normal'}}>د.ك</span></span>
        </div>
        <button onClick={handlePay} disabled={loading || !languages.length} aria-busy={loading} style={{width:'100%',height:52,background:loading?'#8b6dd4':P,color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:900,cursor:loading?'wait':'pointer',fontFamily:"var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif",boxShadow:'0 2px 12px rgba(103,71,178,.28)'}}>
          {loading?'جاري التحويل لبوابة الدفع...':`ادفعي الآن — ${priceLabel}`}
        </button>
        <p style={{fontSize:13,color:T2,lineHeight:1.9,marginTop:16}}>راجعي <Link href="/terms" style={{color:P,textDecoration:'underline'}}>شروط الاستخدام</Link> و<Link href="/refund" style={{color:P,textDecoration:'underline'}}>سياسة الاسترجاع</Link> قبل الشراء. توضّح <Link href="/privacy" style={{color:P,textDecoration:'underline'}}>سياسة الخصوصية</Link> كيفية استخدام بياناتك.</p>
        <p style={{textAlign:'center',fontSize:12,color:T3,marginTop:12}}>للمساعدة: <a href={`mailto:${settings.email}`} dir="ltr" style={{color:P,textDecoration:'underline'}}>{settings.email}</a></p>
        <div style={{flex:1}}/>
        <Link href="/" style={{display:'block',textAlign:'center',fontSize:12,color:T3,marginTop:20,textDecoration:'none'}}>← العودة للرئيسية</Link>
      </div>
    </main>
  )
}
