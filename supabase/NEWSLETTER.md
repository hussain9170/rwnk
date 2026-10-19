# Mailing list and policy consent

The footer collects unchecked newsletter consent and sends a 24-hour confirmation message using the existing sending-only Resend key. Opening an email link is read-only. Confirmation and unsubscribe each require a button POST.

The authoritative list is `newsletter_members`. Only members with `unsubscribed_at is null` may be exported or mailed. `newsletter_signups` contains historical request receipts. Never import purchase emails. The admin Newsletter tab lists active members and exports CSV including a signed first-party unsubscribe URL per member. Future campaigns must use a current export, include each recipient's unsubscribe URL, and respect provider suppression. No campaign is sent or scheduled by this change.

Confirmation and unsubscribe use service-only transactional functions and serialize changes for the same email. RLS and revoked anon/authenticated permissions protect the tables and functions. Replay of an old confirmed link cannot reactivate an unsubscribed member. A new explicit signup and fresh confirmation can resubscribe.

The empty Resend segment `Rwnak Newsletter` created during setup is not used by this runtime; the deployed key has sending-only access. No additional credential or permission change was made.

Checkout records the current policy version and server time. Registration records a receipt before signup/OAuth; the auth callback can associate it with the verified account. Existing purchases/accounts are not backfilled with consent. Schema additions are in sections 25 and 26 of `schema.sql`.

Checks: `node scripts/test-newsletter.mjs`, `npx tsc --noEmit`, `npm run build`. SQL state transitions and privilege checks are also tested inside a rolled-back transaction. Physical devices, real mailbox inbox placement and actual payment remain separate checks.
