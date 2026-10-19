import { Tajawal } from 'next/font/google'

export const tajawal = Tajawal({
  // Preload the page's primary script; Latin glyphs remain available on demand.
  subsets: ['arabic'],
  weight: ['400', '700', '800', '900'],
  variable: '--font-tajawal',
  display: 'swap',
})
