# Security issues

Audit of the published app on 9 October 2026, against
[earth-autumn-pepper-marble.grok.me](https://earth-autumn-pepper-marble.grok.me)
and the source at tag `v0.1.0` plus later commits. Another agent should fix
these one at a time. Do not edit `migrations/0001_auth.sql` or
`migrations/0002_business.sql`. Add a new migration for any policy change, and
mirror it in `src/modules/_sql/rls.sql` so the module files stay true.

Do not put passwords, session tokens, or connection strings in this file or in
a commit.

## Already checked — do not redo as if unknown

These held on the live site:

- A request with no session to a customer list server function returned
  `Unauthorized`. It did not return rows.
- A second account, in its own organisation, called `getQuote` with an id from
  the demo organisation. The result was `null`. Its customer list was empty.
- Business server functions in `src/modules/*/actions.ts` use `authMiddleware`.
  `withOrg` in [src/modules/identity/usecases.ts](src/modules/identity/usecases.ts)
  loads the organisation from `org_members`, and the use-cases filter by that
  `org_id`. Queries are parameterised. No string-built SQL was found.
- Business tables use `ENABLE` and `FORCE ROW LEVEL SECURITY`. Policies are in
  [src/modules/_sql/rls.sql](src/modules/_sql/rls.sql).
- `accept_quote` is security invoker and checks `app.user_id` against
  `org_members`. The screen does not call it. See
  [src/modules/_sql/accept_quote.sql](src/modules/_sql/accept_quote.sql).
- The session cookie is `__Host-grok-auth.session_token`: `HttpOnly`, `Secure`,
  `SameSite=Lax`, no `Domain`. Configured in
  [src/lib/auth/server.ts](src/lib/auth/server.ts).
- [src/lib/auth/isolation.server.ts](src/lib/auth/isolation.server.ts) rejects
  scripted requests whose `Sec-Fetch-Site` is `cross-site` or `same-site`.
- No `dangerouslySetInnerHTML` in `src/`.
- `@tanstack/react-start` is `1.168.60` (at or above the patched 1.168.60 line).

## 1. Public signup, and known demo accounts

Severity: fix before real client or crew data.

`emailAndPasswordEnabled` is `true` in
[src/lib/auth/email-password.ts](src/lib/auth/email-password.ts). The live site
lets anyone create an account and an organisation. There is no email
confirmation and no rate limit.

Two accounts already exist and must not stay as they are:

- `demo@2-have.eu`, organisation **2-have**. This holds the AV demo data
  (customers, quotes, stock, crew). The password was shared in chat. Treat it
  as known. Do not copy that password into git.
- An account named **Audit**, email starting with `audit-` and ending in
  `@2-have.example`, organisation **Audit leeg**. Created during the audit.
  It has no business rows. The password was not written down here.

What to do:

1. Remove both users, or change the demo password and disable further sign-up
   once the real owner exists. There is no admin screen. Deleting means the
   auth tables (`user`, `session`, `account`) plus `org_members` and the
   organisation's business rows. Do this in a transaction as the database
   owner, not through a new public action.
2. For a one-company app, stop public sign-up after the owner's account
   exists. Do not edit `src/lib/auth/server.ts` (it is frozen). The switch
   that exists today is `emailAndPasswordEnabled`. Turning it off also removes
   the owner's email/password login, so prefer a closed sign-up (reject
   `sign-up` when an organisation already exists) over disabling the method
   entirely. Ask before inventing an invite system.
3. Do not add a "delete all data" server function.

## 2. The page can be framed

Severity: medium for a user who is signed in.

The live response sends `Strict-Transport-Security` and no
`Content-Security-Policy`, no `frame-ancestors`, no `X-Content-Type-Options`,
no `Referrer-Policy`.

Other apps on `*.grok.me` are same-site. `SameSite=Lax` still sends this
cookie on a same-site iframe navigation. The isolation check allows
`Sec-Fetch-Mode: navigate` unless the destination is `object` or `embed`. It
does not reject `iframe`. A neighbouring app can frame this one and overlay
clicks. It cannot read the response.

What to do:

- Send `Content-Security-Policy: frame-ancestors 'self'` on document
  responses. Add `https://grok.com` only if the builder preview must embed
  the published host. Confirm that before widening it.
- Add `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`.
- Do not put this only on the login page. The signed-in shell is the target.

## 3. `org_members` insert policy is wider than the use-case

Severity: low today, because no action inserts a membership for a chosen
organisation. High if a later use-case passes a client-supplied `org_id`.

In [src/modules/_sql/rls.sql](src/modules/_sql/rls.sql), `org_members_insert`
only checks that `user_id` is the caller and `role` is `owner`. It does not
check that the organisation is new or empty. A caller who can insert a row
could become owner of someone else's organisation.

`orgs_insert` only checks that `app.user_id` is non-empty.

`createOrg` in [src/modules/identity/usecases.ts](src/modules/identity/usecases.ts)
is safe: it refuses a second membership, generates the id itself, and inserts
the membership in the same transaction. Keep that behaviour.

What to do, in a new migration:

- `org_members` insert: the caller is the `user_id`, the role is `owner`, and
  the organisation has no members yet.
- Do not allow a member to insert a second owner.
- Leave `createOrg` as the only writer.

## 4. Auth tables have no row-level security

Severity: low while every business query stays parameterised and goes through
`withOrg`.

[migrations/0001_auth.sql](migrations/0001_auth.sql) creates `user`, `session`,
`account`, and `verification` with no RLS. `account` holds password hashes and
OAuth tokens. The grants in [src/modules/_sql/grants.sql](src/modules/_sql/grants.sql)
do not give `app_user` those tables. Better Auth uses the database owner
connection, which can read them. A later bug that runs SQL as the owner,
before `set local role app_user`, could read every session and hash.

What to do:

- Do not turn RLS on inside `0001_auth.sql`. Better Auth must keep reading
  those tables as the owner.
- Do not grant them to `app_user`.
- Any new query must keep using `$1` placeholders and `withOrg`.

## 5. Role switch ignores `BYPASSRLS`

Severity: low. The live cross-organisation test passed because use-cases pass
`org.id` from membership, not only because of RLS.

`armRls` in [src/modules/identity/usecases.ts](src/modules/identity/usecases.ts)
switches to `app_user` only when `current_user` is a superuser. A role that is
not superuser but has `rolbypassrls` skips forced RLS and would not be
switched.

What to do:

- Also switch when `rolbypassrls` is true, using the same `set local role
  app_user` path, and only when that role exists.
- Keep the `org_id` filter in the use-cases. RLS is the second line, not the
  first.

## 6. Owner and member can do the same things

Severity: note, not a bug, while each organisation has one user.

`org_members.role` is `owner` or `member`. No action checks it. The first user
is the owner. A future member could accept quotes, change stock, and edit
prices.

What to do: nothing until a second person is a real feature. When that
happens, decide which actions are owner-only before adding an invite.

## Out of scope

- Do not add a workflow engine, a second app, or HTTP between modules.
- Do not add a public wipe or export endpoint to clean up the demo data.
- The in-chat preview database is not the published database. Fixes to RLS
  must be a new migration so Neon picks them up on the next deploy.
