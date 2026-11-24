# Meta conversion events

Pixel: `850585977987749` (RWNAK WEBSITE).

- `PageView`: existing public-page event.
- `ViewContent`: once per checkout mount, with the displayed product value/currency.
- `InitiateCheckout`: once per checkout mount after email/language/policy validation, before creating/continuing the payment session. A failed validation does not emit it.
- `Purchase`: only after the protected purchase-status API returns `completed`, using its amount, currency and non-secret `tracking_id`. This guard is independent of GA4 and handles a pending payment becoming completed.

All events use product IDs, `value` and ISO currency. No email, name, payment details, raw purchase UUID or download credentials are intentionally forwarded. `lang` on checkout links and public `fbclid` parameters are supported; private URL parameters and referrers are rejected. New events honour Global Privacy Control.

## Receipt isolation

Do not load the Meta SDK on `/success`: its URL contains purchase credentials. Purchase uses a hidden, static `/meta-purchase-frame.html` with `referrerPolicy=no-referrer` and a `sandbox=allow-scripts` opaque origin. Neither `allow-same-origin` nor parent credentials are provided. Message source/origin is checked on both sides; only commerce fields and the public event ID are passed. The child rebuilds an allowlisted payload, disables automatic configuration, loads the SDK and then dispatches the event. Opening the frame on its own sends nothing.

Only this static document overrides the site's anti-framing headers. It has a restrictive CSP, noindex and no application layout. Normal pages retain DENY / frame-ancestors none.

A stable `eventID` and independent localStorage/in-memory guards reduce duplicate Purchase dispatch on refresh/reopen. No marker is written if the SDK is blocked or does not initialize. An acknowledgement means the event was handed to the SDK, **not** proof of receipt by Meta. Refreshing the same order in another browser can still generate an event with the same ID; browser guards do not provide globally exactly-once delivery.

The isolated document cannot access first-party storage or parent page context. Matching/attribution may therefore be weaker than a conventional pixel or a consented server-side Purchase integration. This change does not implement Purchase CAPI, configure an access token, backfill orders or send test purchases. Purchase requires a same-tab sessionStorage marker from a validated new checkout within 24 hours and a server-returned order creation time at or after that checkout (60-second clock tolerance). Opening an old receipt without that context does not generate a new sale. Blocked session storage, cross-tab returns and a buyer who never returns can prevent browser Purchase measurement.

## Verification

Offline:

```
node scripts/test-meta-client.cjs
node scripts/test-homepage-cache.cjs
npx tsc --noEmit
npm run test:payment
```

The Meta test exercises private URL rejection, verified completed-only Purchase, malformed payloads, authenticated bridge messages, isolated commerce data, SDK-blocked retries and independent deduplication. The production fixture build verifies the special document's HTTP headers and preserves anti-framing on normal pages. These tests do not call Meta, the payment provider, email or a real database.

After deployment, verify a legitimate new checkout in Events Manager / Test Events. Check ViewContent and InitiateCheckout, then verify Purchase after an authorized paid transaction, its actual currency/value and stable event ID. Check that pending/cancelled orders do not produce Purchase and refresh does not dispatch it again. Do not send made-up purchases to production or equate code tests with Events Manager confirmation. Inspect browser/server sources separately if enabling CAPI later; use the same event name and ID when deduplicating.

References:
- https://developers.facebook.com/documentation/meta-pixel/reference
- https://developers.facebook.com/documentation/meta-pixel/implementation/conversion-tracking
