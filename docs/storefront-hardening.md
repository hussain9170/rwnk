# Storefront hardening — 18 October 2026

## Release behavior

- No purchase UUID/email pair can change a password. Retired account mutation endpoints return 410. Password creation uses the existing email recovery/verification flow.
- A purchase UUID alone no longer returns order details or issues download tokens. Guest access is HMAC signed, purchase bound, and valid for 30 days. Signed-in owners keep library access subject to the existing download quota.
- Callback redirects only issue a signed guest URL when the original signed checkout capability accompanies the gateway redirect. Older callback URLs still verify payment but redirect to account login.
- Older plain-UUID receipt links require login/recovery with the purchase email. Purchases and download quotas are retained.
- Invoice creation reserves the existing `purchases.payment_ref` atomically. A `creating:` reservation cannot be reclaimed automatically after a timeout; reconcile with the gateway before resetting it. Successful attempts store their reusable URL in existing server-only `transaction_details`.
- A verified paid result may recover a failed purchase; completed/refunded purchases remain final.
- Checkout server-renders its quote and ready languages with a 60-second revalidation period. Existing admin mutations invalidate checkout. The API refuses a stale price and unavailable language.
- Download resolution never substitutes Arabic for a missing English file.
- Dependencies updated; security response headers added; error-level lint findings resolved. Existing type warnings remain tracked, not disabled.

## Prepared database change — NOT APPLIED

`supabase/migrations/20261017231557_storefront_hardening.sql` is prepared and requires separate production approval. It is not installed.

It adds two RLS-protected server-only tables (`request_limits`, `purchase_email_outbox`), service-role-only functions, an email enqueue trigger for future completed purchases, and eight foreign-key indexes. It does not delete orders, change prices, or backfill/send old customer emails.

Before approval, the application preserves direct confirmation-email delivery and uses a per-process limiter. Shared limits and durable retries only activate after the migration is explicitly approved and applied. The application never runs DDL itself.

The queue saves one payload and provider idempotency key per purchase, claims work with a two-minute lease, tries at most five times, and stops automatic retry after 23 hours from the first attempt (inside Resend's 24-hour deduplication window). Exhausted jobs require investigation; they are not silently marked sent. The existing protected cron and authorized receipt visits drain eligible jobs.

## Validation

- Production build, TypeScript, lint (warnings separately reported).
- Payment decision suite and existing auth/recovery/download suites.
- New signed-access, credential-endpoint retirement, wrong-owner, concurrent invoice reservation and callback capability regression tests.
- Live production payment and actual device Apple Pay remain manual verification steps; do not make a real charge from test scripts.
