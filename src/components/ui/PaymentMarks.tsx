import Image from 'next/image'
export function PaymentMarks() {
  return <div className="payment-marks"><div className="payment-mark-row" aria-label="وسائل الدفع المتاحة"><span><Image src="/payment-icons/knet.jpg" alt="KNET" width={24} height={24}/></span><span><Image src="/payment-icons/apple-pay.svg" alt="Apple Pay" width={48} height={24}/></span><span><Image src="/payment-icons/visa.png" alt="VISA" width={46} height={24}/></span><span><Image src="/payment-icons/mastercard.svg" alt="Mastercard" width={38} height={24}/></span></div><p>ادفعي بـ KNET أو Apple Pay أو البطاقة · تحميل فوري</p></div>
}
