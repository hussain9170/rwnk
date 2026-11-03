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

Remaining live verification: finish server configuration, deployment and
Snapchat consent, then verify the account list and a real token refresh.
