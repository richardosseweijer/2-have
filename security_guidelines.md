# Security guidelines

Hard rules for every change to 2-have. They bind every agent and every human
edit. They are not advice.

If a feature request, a shortcut, or another document disagrees with this
file, stop and follow this file. Tell the user what you refused. The only
exception is a platform fence in [AGENTS.md](AGENTS.md): do not block the
`https://grok.com` branding script, do not remove `PreviewHostBridge`, and do
not strip the platform branding. A content-security policy may still set
`frame-ancestors`. It must not block that script.

Open gaps are listed in [security_issues.md](security_issues.md). Do not mark
one fixed unless the check named there passes. Do not claim the app is
invite-only, or GDPR compliant, while those gaps are open.

The product is one company, 2-have. Dutch screens. Personal data of customers,
crew, suppliers, and users stays inside that company.

## 0. How to change the app

1. One security fix at a time. Check it. Then the next.
2. Do not edit `migrations/0001_auth.sql` or `migrations/0002_business.sql`.
   A policy or table change is a new `migrations/000N_*.sql`, mirrored in the
   module `schema.sql` or `src/modules/_sql/` so those files stay true.
3. Do not put passwords, session tokens, connection strings, or copies of
   personal data into git, logs, error text, or this file.
4. The server is the authority. Hiding a button is not access control.
5. Parse with Zod at the module boundary and again in the use-case.
6. If a rule below is unclear for the change you are about to make, stop and
   ask. Do not guess a weaker reading.

## 1. Invitation and whitelist

The app is invitation-only. Public sign-up is forbidden.

1. A person can get a session that reads or writes business data only when
   their email is on an invitation an admin has not revoked, or they are the
   single bootstrap admin.
2. The bootstrap admin is one email supplied by the server environment. It is
   not a `VITE_` variable, not committed, and not typed into a public form.
   There is no second bootstrap path.
3. After that admin exists, close self-service sign-up. Rejecting sign-up in
   the app is required. Do not do it by turning off email/password in a way
   that also locks the admin out. Do not edit `src/lib/auth/server.ts`; that
   file is frozen.
4. An invitation names the email, the role, and the grants. It expires. A
   revoked invitation or a revoked user cannot sign in, and existing sessions
   for that user stop working on the next request.
5. No shared passwords. No demo accounts on the published database. No default
   password in the repo.
6. The current open sign-up in `src/lib/auth/email-password.ts` does not meet
   this rule. Do not add personal-data fields, and do not tell the user the
   site is closed, until this rule is actually enforced.

## 2. Who may see what

Default is deny. An admin grant is the only way to see someone else's data.

1. **Admin** can invite, revoke, and change grants. An admin can see the
   organisation's data needed to administer it. A non-admin cannot remove the
   last admin or change the admin's grants.
2. **User** sees only records they created, plus the grants an admin stored
   for them. Nothing else. Not the whole organisation.
3. A grant is a stored row: who, which module or which record, read or write,
   who granted it, and that it can be revoked. No grant means no access.
4. Do not default a new user to every customer, quote, project, crew member,
   or price. Do not copy the current policy "any `org_members` row sees every
   row in the org" onto new tables once grants exist. That predicate is the
   current code. It is not the allowed end state.
5. `org_members.role` of `owner` or `member` does not implement this. Do not
   treat those two values as done.
6. Enforce the check in the use-case and in row-level security. Both. A
   client-supplied id is never trusted on its own.
7. `created_by` (the verified user id) is required on new business rows that
   a user can own. Do not add a table that cannot be limited to its creator
   and to an explicit grant.

## 3. EU personal-data rules

These rules implement Regulation (EU) 2016/679 (GDPR) and the Dutch UAVG for
this controller. They are never optional. A feature that needs you to ignore
one of them is refused.

Personal data here includes a name, email, phone, address, login, session,
IP address, user agent, and any note that identifies a person. Customer,
crew, supplier, and user records are personal data. Prices and stock counts
are not, unless they are tied to a person.

### 3.1 Principles (Article 5)

1. **Lawful, fair, transparent.** Do not store a new category of personal data
   until the lawful basis is written in the processing register in this file.
   For customers and crew the basis is the contract with 2-have or the
   company's legitimate interest in running the job. Do not pretend a cookie
   banner makes an unlawful collection lawful.
2. **Purpose limitation.** Data collected to plan a job is not reused for
   marketing, model training, or another module's external service.
3. **Minimisation.** Collect only fields the screen needs. Do not add a
   free-text dump, a copy of a mailbox, or "just in case" columns.
4. **Accuracy.** An admin, and the person if they have a login, must be able
   to correct their own contact data.
5. **Storage limitation.** Personal data is kept only as long as the purpose
   or a legal retention duty requires. When that ends, delete it or reduce it
   so the person is no longer identifiable. Do not invent "keep forever".
6. **Integrity and confidentiality.** The access rules in this file and the
   issues in `security_issues.md` are part of this duty.
7. **Accountability.** If you add or change a category of personal data,
   update the register below in the same change.

### 3.2 Special categories and children

Do not store health, biometrics, union membership, religion, or any other
Article 9 data. Do not collect data about children. If a request needs either,
stop and ask. The answer is still no unless the user has a written lawful
basis and you have recorded it.

### 3.3 Rights of the person (Articles 15 to 21)

Admin-only. Never a public route.

1. **Access and portability.** An admin can export one person's data. The
   export contains that person, not the whole company.
2. **Rectification.** An admin can correct that person's contact fields.
3. **Erasure and restriction.** An admin can erase or restrict a person.
   Quotes, orders, and other records that Dutch tax law requires the company
   to keep (the fiscal administration, generally seven years) are not
   deleted. Strip or replace the contact details that are no longer needed,
   and keep the financial lines. If you cannot tell those apart, stop and ask.
   Do not silently delete accounting records, and do not silently refuse the
   request.
4. **Objection.** Do not add a process the person cannot object to where the
   basis is legitimate interest.

### 3.4 Processors and transfers (Articles 28 and 44 to 49)

1. Do not add a third-party script, font, image host, analytics tag, chat
   widget, or API that receives personal data or the visitor's IP address.
2. Do not send customer, crew, supplier, or user data to an LLM or other
   external model.
3. A new processor is allowed only after the user accepts it in this chat,
   and only with a Chapter V transfer tool if the processor is outside the
   EEA and the country has no adequacy decision. Record it in the register.
4. The processors already in the stack are a known gap, not a permission to
   add more. Do not claim the transfers are covered. Do not move the database
   yourself. Ask the user before changing host or region.

Current processors, as of 9 October 2026. Region was not verified in this
repo. Treat them as outside the EEA until the user confirms otherwise.

| Processor | What leaves the browser or the server |
| --- | --- |
| Neon (Postgres) | All business and auth rows, including contact data and password hashes |
| The Grok / Vercel deploy path and Cloudflare | The request, the session cookie, IP address |
| Grok auth broker | Identity when Google or X sign-in is used |
| Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) | Visitor IP, requested from [src/routes/__root.tsx](src/routes/__root.tsx) |

### 3.5 Cookies and the terminal

The session cookie is strictly necessary for a service the signed-in user
asked for. Do not add analytics cookies, marketing cookies, or extra
identifiers. Do not store personal data in `localStorage`. The preview bearer
token in `sessionStorage` is only for the sandbox iframe. Do not copy that
pattern into the published app.

### 3.6 Breach

If you find that personal data was exposed, readable across organisations, or
sitting in a public place, stop feature work. Tell the user in that same
turn: what data, how wide, and what you already closed. Do not hide it to
finish the task. The controller's duty to notify a supervisory authority is
72 hours from becoming aware. You do not notify an authority yourself.

### 3.7 Logging

Do not log names, emails, phones, addresses, tokens, or row contents. An
error the user sees may say what failed in Dutch. It must not repeat their
personal data or a stack that contains it.

## 4. Fences

Must:

- Call `authMiddleware` on every server function that reads or writes data.
- Scope every query by the verified user and by an admin grant or ownership.
  Pass `org_id` from `withOrg`, never from the client.
- Enable and force row-level security on every new business table.
- Switch role to `app_user` when the connection is superuser or has
  `BYPASSRLS`, when that role exists.
- Keep SQL parameters as `$1` placeholders. No string-built SQL.
- Keep money as integer cents. Snapshot the line price.
- Set `frame-ancestors` to `'self'` unless the user has agreed to a wider
  list. `https://grok.com` may be added only so the builder can embed the
  app. Never `*`.
- Send `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`.

Must not:

- Must not ship a server function without authentication.
- Must not let one organisation read another organisation's rows.
- Must not let a user read another user's rows without a stored admin grant.
- Must not trust `Sec-Fetch-Site` alone. Missing Fetch Metadata is not proof
  of a same-origin browser. State-changing calls still need the session and
  the origin check Better Auth already applies to its own routes.
- Must not grant `app_user` access to `user`, `session`, `account`, or
  `verification`.
- Must not add a public export, a public wipe, or a public "delete my
  company" action.
- Must not weaken a policy to make a test pass.
- Must not store Article 9 data.
- Must not add a third-party request that receives an IP address or personal
  data.
- Must not put personal data in a URL query string.
- Must not commit the demo password or create another known demo login on the
  published site.

## 5. Processing register

Update this table in the same change that adds, drops, or reuses a category.
Lawful basis is for 2-have as controller, running its own installation work.

| Category | Fields | Why | Basis | Where | How long |
| --- | --- | --- | --- | --- | --- |
| Users | name, email, password hash, session token, IP address, user agent | Sign-in | Contract with the user who was invited | `user`, `account`, `session` in the auth migration | While the account exists. IP and user agent are a minimisation gap; see security issues. |
| Customers | name, contact name, email, phone, address, notes | Quotes and jobs | Contract, or legitimate interest in running the job | `customers` | Life of the commercial relationship. Financial documents that cite the customer follow the tax retention fence in §3.3. |
| Crew | name, email, phone, notes, kind (employee or freelancer) | Planning people onto a job | Contract or legitimate interest | `crew_members` | While they can be planned, then erase or reduce. |
| Suppliers | name, email, phone | Purchase orders | Contract | `suppliers` | Life of the supply relationship. |

Not personal data: article names, cents, stock quantities, quote totals, as
long as the row does not name a person. A quote or order that copies a
customer name is personal data.

## 6. What is not built yet

Do not describe the following as done:

- Closed sign-up and invitations.
- Admin, user, and grants. Users are not limited to their own rows.
- Export, correction, and erasure for one person.
- A content-security policy.
- An EEA-only hosting setup. Google Fonts is still loaded.

The next agent starts from [security_issues.md](security_issues.md), one item,
then checks.
