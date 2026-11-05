# TikTok confirmed purchase integration

- Production secret: `TIKTOK_EVENTS_ACCESS_TOKEN` (never NEXT_PUBLIC).
- Pixel code: DBMFUP3C77UA5QM455NG. Endpoint: Events API v1.3 `/event/track/`.
- Optional per-order checkbox defaults off. The server requires an explicit boolean true and excludes requests with `Sec-GPC: 1`. No historical backfill.
- Records a consent receipt in `tiktok_purchase_outbox` during checkout. Only a verified `completed` purchase with a real `paid_at` can be claimed and emitted.
- Sends SHA-256 email (matching data, not anonymous), optional `_ttp` cookie/user-agent, actual price/currency/product ID, and a stable SHA-256 event ID. Never sends raw email, name, phone, payment details, purchase bearer IDs, access tokens or success URLs.
- Callback, authorized purchase-status reads and a daily 03:00 UTC retry job invoke the queue. Server-only claims use leases and a primary key per order; stable IDs permit TikTok deduplication on uncertain retries. Maximum 20 attempts, within 6 days of payment.
- Only HTTP success AND TikTok code 0 counts as accepted. Delivery failure never blocks purchase or email. Matching cookies/UA are cleared after acceptance or after 7 days during cleanup.
- Consent withdrawal requests: set `revoked_at=now()` for the corresponding unsent outbox entry. Already transmitted events cannot be recalled by this code. Do not send a test purchase as a real conversion.
- No browser SDK on receipt/account/auth URLs. Browser ViewContent/InitiateCheckout remain separate from server Purchase.
- Verification: tests cover paid/pending/failed/refunded states, consent, private data, dedup IDs, API error/retry handling. Database transaction tests verify leases and restricted privileges with all fixtures rolled back. A real new opted-in paid order (or Events Manager server test code) is still needed for end-to-end TikTok acceptance verification.

## Test verification — 2026-11-06 (Kuwait)

A synthetic Purchase sent with Test Events code TEST29992 was accepted by TikTok with HTTP 200 / API code 0. Request ID: 20261105233635F0161FFB512C27D3AC00. No orders or live conversion queue were written. The temporary authenticated endpoint was removed and its credential disabled afterward. Test acceptance verifies token and server transport; a genuine opted-in checkout has not yet been validated end-to-end.
