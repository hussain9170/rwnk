import type { NextConfig } from "next";

// Admin can set an arbitrary product image URL (src/components/admin/ContentTab.tsx
// -> store_settings.product_image_url), rendered with next/image on the landing
// page (src/app/page.tsx). Without a matching remotePattern, next/image throws
// at request time for any non-local hostname. Supabase Storage public URLs are
// the expected case; the project's own storage host is derived from
// NEXT_PUBLIC_SUPABASE_URL so it works without extra config.
let supabaseHostname: string | undefined
try {
  supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : undefined
} catch {
  supabaseHostname = undefined
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://*.myfatoorah.com https://*.tap.company; upgrade-insecure-requests" },
      ] },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/success', headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ]
  },
  // A lockfile in a parent folder (outside this repo) made Next guess the
  // wrong workspace root. Pin it explicitly to this project.
  // A lockfile in a parent folder (outside this repo) made Next guess the
  // wrong workspace root. Pin it explicitly to this project.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [{ protocol: 'https' as const, hostname: supabaseHostname, pathname: '/storage/v1/object/public/**' }]
        : []),
    ],
  },
};

export default nextConfig;
