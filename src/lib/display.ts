export const arabicNumber = (value: number) => new Intl.NumberFormat('ar-KW', { maximumFractionDigits: 3 }).format(value)
export function supportWhatsapp(value: string): string | null {
  const number = value.replace(/[\s+()-]/g, '')
  if (/(\d)\1{5}$/.test(number)) return null
  return /^[1-9][0-9]{7,14}$/.test(number) ? `https://wa.me/${number}` : null
}
