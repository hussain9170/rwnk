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

## Production database activation — 18 October 2026, Kuwait time

`supabase/migrations/20261017231557_storefront_hardening.sql` was explicitly approved and applied to production as migration `20261017234928_storefront_hardening` (17 October 2026 23:49 UTC / 18 October 2026 02:49 Kuwait).

It adds two RLS-protected server-only tables (`request_limits`, `purchase_email_outbox`), service-role-only functions, an email enqueue trigger for future completed purchases, and eight foreign-key indexes. It does not delete orders, change prices, or backfill/send old customer emails.

Shared rate limits and the durable confirmation-email queue are now installed. RLS and grants were verified: anonymous and customer roles cannot read the new tables or execute the three server functions; service-role access is enabled. The completion trigger and all eight indexes are present. No historical emails were queued. The rate-limit function passed allow/allow/block assertions in a rolled-back transaction, and the live receipt route still rejects anonymous access. The application never runs DDL itself.

The queue saves one payload and provider idempotency key per purchase, claims work with a two-minute lease, tries at most five times, and stops automatic retry after 23 hours from the first attempt (inside Resend's 24-hour deduplication window). Exhausted jobs require investigation; they are not silently marked sent. Completion handling, the existing protected daily cron and authorized receipt visits drain eligible jobs. The daily schedule does not guarantee a retry within 23 hours for every failed job; a more frequent authenticated scheduler remains an operational improvement. No real customer email was sent for this activation test.

## Validation

- Production build, TypeScript, lint (warnings separately reported).
- Payment decision suite and existing auth/recovery/download suites.
- New signed-access, credential-endpoint retirement, wrong-owner, concurrent invoice reservation and callback capability regression tests.
- Live production payment and actual device Apple Pay remain manual verification steps; do not make a real charge from test scripts.
