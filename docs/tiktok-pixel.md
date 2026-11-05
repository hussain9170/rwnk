# TikTok Pixel — rwnak.net

- Advertiser: `7644750580203814929`
- Pixel: `RWNAK - rwnak.net`
- Public pixel code: `DBMFUP3C77UA5QM455NG`
- API pixel ID: `7704811596194906120`
- Events: PageView on approved public URLs, ViewContent on checkout, InitiateCheckout after checkout form validation.
- No Purchase event is installed in this change. Never optimize a sales campaign against InitiateCheckout as if it were a confirmed purchase.
- Automatic advanced matching and expanded data sharing disabled in Events Manager.
- No SDK on success/account/auth/admin/API URLs or private query parameters/referrers. A full reload unloads an already-running SDK on a client transition to a private URL.
- No customer email/phone, payment details, access tokens, order IDs or receipt URLs are intentionally sent. Existing Google, Meta and Snap tracking is unchanged.
- Verify real browser events with TikTok Events Manager Test Events / Pixel Helper. Ad blockers can suppress delivery.
- Purchase tracking still needs a separate server integration triggered only by the verified payment result, with an Events API token, consent handling as appropriate, and order deduplication. Do not load the SDK on the token-bearing receipt page.

Validation: `node scripts/test-tiktok-client.cjs`, `npx tsc --noEmit`, targeted ESLint, production build.
