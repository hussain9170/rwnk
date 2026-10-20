import { unstable_cache, revalidateTag } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// Only published, anonymous CMS lists belong here. Never cache account,
// payment, price, availability, or dashboard queries through this helper.
const PUBLIC_LISTS = ['faqs', 'features', 'testimonials', 'comparison_rows'] as const
export type PublicList = typeof PUBLIC_LISTS[number]

export async function getPublicList<T>(table: PublicList): Promise<T[]> {
  if (!PUBLIC_LISTS.includes(table)) throw new Error('Not a public CMS list')
  return unstable_cache(async () => {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    )
    const { data, error } = await sb.from(table).select('*')
      .eq('is_active', true).order('sort_order', { ascending: true })
    // Throw before caching: a temporary failure must not persist fallback copy.
    if (error) throw new Error(`[public-content/${table}] ${error.message}`)
    return (data ?? []) as T[]
  }, ['public-cms-v1', table, process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''], {
    tags: [`public-cms:${table}`],
    revalidate: 300,
  })()
}

export function invalidatePublicContent(resource: string): void {
  if (PUBLIC_LISTS.includes(resource as PublicList)) {
    // Route handlers cannot use updateTag. expire:0 makes the very next
    // visitor wait for fresh content instead of seeing one stale response.
    revalidateTag(`public-cms:${resource}`, { expire: 0 })
  }
}
