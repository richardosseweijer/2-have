# 2-have — instructions for further work

The product is **2-have** (site 2-have.eu). Dutch UI. English identifiers. One TanStack Start app, one Postgres database, eight modules under `src/modules`. Read [ARCHITECTURE.md](ARCHITECTURE.md) for the narrative. This file is the contract.

## Do not

- Do not add a second deployable, an HTTP client between modules, an event bus, a plugin loader, or a workflow engine.
- Do not deep-import another module. Allowed: `from "../orders"` or `from "@/modules/orders"`. Forbidden: `from "../orders/usecases"`, `from "@/modules/orders/boundary"`. `scripts/module-boundary.test.mjs` enforces this.
- Do not let orders write quote tables, or quotes insert order lines. Cross-module work is a function on the caller's transaction.
- Do not store money as floats. Integer cents. Quantity numeric. Snapshot `unit_price_cents` on the line. Never re-price old quotes or orders when an article changes.
- Do not create an order except through `orders.createFromQuote`, called from `quotes.acceptQuote`, in that same transaction.
- Do not drop `org_id` from a business table. Do not skip RLS on a new table.
- Do not import `@/lib/db` from a module component. Server functions live in `actions.ts`.
- Do not put business SQL in `src/routes`. Routes load a server function and render a module component.
- Do not redraw the logo, and do not put raw hex in components. Brand tokens are in `src/styles.css`.
- Do not restore the removed login copy ("Offertes die een bestelling worden…"). The signed-out panel says **2-have home**.
- Do not rename the product back to Noordlijn.

## Brand tokens

Declared in `src/styles.css` `@theme`. Use the Tailwind names.

| Token | Hex | Use |
| --- | --- | --- |
| `navy` | `#002083` | Primary buttons, links, logo field |
| `navy-2` | `#1A3C9C` | Primary hover |
| `orange` | `#FC4F00` | Logo circle. Spare accent only |
| `amber` | `#FF9D25` | Logo upper bar |
| `sky` | `#479FE7` | Logo lower bar |
| `paper` / `paper-2` | `#F4F7FB` / `#FFFFFF` | Page and cards |
| `ink` / `muted` / `line` | `#071433` / `#5A6A86` / `#D7E0EE` | Text and borders |

Status chips keep `ok`, `warn`, `bad`. `warn` is a darkened amber so small text stays readable. Logo file: `public/brand/logo.svg` (alpha outside the navy field). Favicon is the same mark. `src/components/logo.tsx` is the only component that renders it. Wordmark text is `2-have`. Shell footer text is `2-have.eu`.

## Module contract

```
src/modules/<name>/
  index.ts       public API: use-cases and types. This is the module boundary.
  schema.sql     tables for this module only
  boundary.ts    Zod input and output types
  usecases.ts    business logic. First argument is Tx when it touches the database.
  actions.ts     createServerFn wrappers. authMiddleware, then dynamic-import the use-case.
  components/    UI. May import this module's actions and types.
```

`index.ts` of deals, orders, and quotes is what other modules call. `actions.ts` may dynamic-import `../identity` (the index) for `withOrg`. Importing your own `./usecases` from `actions.ts` is fine.

Shell nav is `moduleNav` in `src/modules/registry.ts`. Projects and planning are `later: true`. Their tables exist; they have no use-cases. Build those use-cases in the module before adding behaviour to the page.

## Transaction and tenancy

- `identity.withOrg(userId, fn)` opens the transaction, sets `app.user_id`, switches to role `app_user` when the connection is a superuser, loads the org, then runs `fn(tx, org)`.
- Every query in a use-case takes that `tx`. Do not call `getSql()` inside a use-case.
- First user creates an org and is `owner`. One org per user (unique on `org_members.user_id`).
- New tables: `org_id` not null, RLS enabled and forced, policy matching the `org_members` predicate used in `src/modules/_sql/rls.sql`.

## Accept path (do not split)

`quotes.acceptQuote(tx, { orgId, quoteId })`:

1. `select … for update`. Status must be `draft` or `sent`. At least one line.
2. Allocate `OFF-####` from `quote_counters` if `number` is null.
3. `winDeal` from the deals index. Deal status `won`.
4. `createFromQuote` from the orders index. Copies description, qty, unit, `unitPriceCents`, position. Order status `confirmed`. Allocates `ORD-####` from `order_counters`. Does not read `articles`.
5. Quote status `accepted`.

Reject calls `loseDeal`. Create quote calls `openDeal`. Status sets: quote `draft | sent | accepted | rejected`, deal `open | won | lost`, order `confirmed | in_progress | done | cancelled`.

## Schema changes

Edit the module `schema.sql` so the folder still documents the table. Apply the change with a new file `migrations/0003_*.sql` (or the next number). Do not rewrite `migrations/0001_auth.sql` or `migrations/0002_business.sql` after they have run. `0002` is the concatenation of module `schema.sql` files plus `src/modules/_sql/{rls,grants,accept_quote}.sql`.

## Adding a module

1. Folder as above. `org_id` on every table. Zod at the boundary. Parse inside the use-case.
2. Export the public functions from `index.ts` only.
3. Route file under `src/routes/_app/` that calls the action and renders the component. Register the path in `ModuleNavItem` if you add a nav href.
4. One `moduleNav` entry.
5. Other modules, if they must react, call your index with the existing `tx`.
6. `node --test scripts/module-boundary.test.mjs` must pass.

## UI

- Dutch labels on screens. Keep the existing copy style: short, no slogan on the signed-out panel.
- Tokens only. Primary action is `Button` variant `primary` (`bg-navy`).
- One primary action per view. Order detail stays read-only.
- Mobile first. Tap targets stay at least 44px. No horizontal overflow.
