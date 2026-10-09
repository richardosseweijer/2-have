# 2-have

One app, one Postgres database. Eight business modules. Dutch screens, English names in code and columns. The product name is **2-have** (site [2-have.eu](https://2-have.eu)).

How the pieces fit, and how to add the next module: [ARCHITECTURE.md](ARCHITECTURE.md). Rules for anyone (or any agent) changing the code: [AGENTS.project.md](AGENTS.project.md). Access control and EU personal-data rules: [security_guidelines.md](security_guidelines.md). Open gaps: [security_issues.md](security_issues.md).

## Module rule

A module owns its tables, its use-cases, and its UI. **Other modules may only import that module's `index.ts`.** Deep imports (`modules/orders/usecases`, `modules/quotes/boundary`, and so on) are forbidden.

Cross-module work is a function call on the same database transaction. The quotes module calls `deals.winDeal` and `orders.createFromQuote` from `acceptQuote`. Orders does not write quote tables. The shell owns no business tables. The nav is the list in `src/modules/registry.ts`.

There is no second deployable, no HTTP between modules, and no event bus.

## Money and accept

Prices are integer cents. A quote line stores description, quantity, unit, and `unit_price_cents` at the moment it is written. Changing an article price later does not rewrite quote lines or order lines.

Accepting a quote is one transaction:

- quote status becomes `accepted`
- the open deal becomes `won`
- an order is created as `confirmed`
- lines are copied
- numbers `OFF-0001` and `ORD-0001` are allocated per organisation inside that transaction

`accept_quote(quote_id uuid)` in the migration is the same contract for a direct SQL caller. The screen calls `quotes.acceptQuote`.

## Layout

```
src/modules/<name>/
  index.ts       public use-cases and types
  schema.sql     this module's tables
  actions.ts     thin server functions
  usecases.ts    the work
  components/    the UI, when the module has one
src/modules/registry.ts
migrations/0002_business.sql   concatenation of the schema files, then RLS, then accept_quote
```

Routes under `src/routes` only load a server function and render a module page.

Projects and planning are in the nav, marked later. Their tables are already migrated. There is no crew-planning UI.

## Brand

The mark is [public/brand/logo.svg](public/brand/logo.svg) (transparent outside the navy field). Colours live in `src/styles.css` as `--color-navy`, `--color-orange`, `--color-amber`, and `--color-sky`.
