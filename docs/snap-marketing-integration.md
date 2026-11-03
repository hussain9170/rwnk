# Snapchat Marketing integration

Organisation: `54c2bdfb-3c68-4b72-af12-019ae7d424a6` (rwnak official).

Client ID: `30198566-d891-4691-8c2b-9ea2624e4e39`.

Registered callback: `https://www.rwnak.net/api/integrations/snapchat/callback`.

## Configuration

Production server environment variables only:

- `SNAP_MARKETING_CLIENT_ID`: OAuth app's client ID.
- `SNAP_MARKETING_CLIENT_SECRET`: OAuth app secret. Store as a Vercel Secret.
- `SNAP_MARKETING_TOKEN_KEY`: independently generated 32-byte key encoded as 64 hexadecimal characters; Vercel Secret. Keep this key to decrypt existing tokens. Changing it requires reconnection.

No variable may use a `NEXT_PUBLIC_` prefix. Never put secrets in Git,
screenshots, URLs, build output, or logs.

Apply `supabase/migrations/20261103210107_snap_marketing_oauth.sql` before
deploying. Both tables have RLS and explicitly deny all `anon` and
`authenticated` access; server role access is granted separately. The
absence of client RLS policies is intentional.

## Connect and verify

1. Sign in to the live website as an active `super_admin`.
2. Open `/admin/snapchat` and start the connection from the form.
3. Review the Snapchat Marketing API consent screen and explicitly approve
   the permissions there. Creating the OAuth app does not itself grant these.
4. The callback consumes a ten-minute, one-use state tied to the same admin
   and a Secure HttpOnly host-only cookie. It verifies access to this
   organisation's ad accounts before saving AES-256-GCM encrypted tokens.
5. The admin page must show a verified connection and the expected accounts.
   A saved connection alone is insufficient proof of current API access.

`GET /api/admin/integrations/snapchat` is restricted to `super_admin`, returns
only status and account metadata, and automatically refreshes expiring
tokens using a database lease. It never returns credentials. Reauthorization
replaces the existing singleton connection. No campaign creation, spending,
publishing, Public Profile access, report scheduling, or autonomous ChatGPT
connection is established by this implementation.

Pending OAuth state rows expire after ten minutes; the next connect request
removes expired rows. Token refresh failures preserve the existing encrypted
connection for retry and release the refresh lease. Reconnect if the grant
has been revoked. Revoke the app in Snapchat to invalidate its grant.

## Validation

`node scripts/test-snap-marketing.cjs` covers encryption and tamper detection,
cookie/state/session checks, callback replay protection, refresh locking and
token rotation, API organisation boundaries and pagination origin checks.
Also run TypeScript, focused ESLint, and `npm run build` before release.

The initial production connection and three account listings were verified
on 2026-11-04 Kuwait time. Automatic refresh has unit coverage; check live
refresh separately from the initial token exchange.

## Reporting and experiment preparation

`/admin/snapchat/report` is owner-only. It compares platform attribution
(7-day swipe, 1-day view, by conversion time) with paid website orders.
Periods are yesterday or the last 7/30 completed Kuwait calendar days;
end times are exclusive. Money from Snap is microcurrency in the account's
currency and is divided by 1,000,000. Purchase values are never assumed to
be KWD when the advertising account is USD. Missing metrics remain unknown.

New ad links identify source, medium, campaign, creative and advertising
account. A consented visitor can retain that coarse source for 30 days.
Only future orders carrying the marker are tagged; historical orders are
not reattributed. Other explicit UTM sources clear the previous Snap marker.
GPC prevents recording and consent withdrawal removes stored attribution.
The public checkout still works if optional attribution storage fails.

Apply `20261103214336_snap_reporting.sql` before deploying these endpoints.
All three reporting tables deny anonymous and authenticated client reads.
`snap_report_snapshots` contains aggregate reports, not customer details,
purchase bearer IDs or OAuth credentials. The existing daily ChatGPT report
can read the latest snapshot through the authorised Supabase connection;
it must report the observation time and flag stale or missing data.

An authenticated Vercel cron calls `/api/cron/snap-report` daily at 14:00 UTC
(17:00 Kuwait; platform timing may vary), refreshing 1/7/30-day reports for
the `rwnak website` account. Manual dashboard reads also refresh snapshots.
This job is separate from the existing purchase/email retry cron.

Cost settings are optional and initially unknown. The calculator shows
observed revenue less modelled fees, allocated costs and converted ad spend;
it is explicitly not final accounting profit and cannot recover purchases
with missing attribution. Use actual bank and payment-provider figures.

Three ad scripts/storyboards with separate tagged links are included for
review. They are not exported media or published ads. The approved initial
test envelope is 6 KWD/day for 7 days (42 KWD total), within a 200 KWD month
cap. The total belongs to the group, not each of three creatives. Launch
remains gated on a genuine post-update paid purchase being confirmed and
final media being prepared. No payment or synthetic purchase is sent by
this implementation. Organic profile analytics require separate access.

Validation: `node scripts/test-snap-report.cjs`, existing Snap tests,
`npm run test:payment`, focused ESLint, TypeScript and production build.
