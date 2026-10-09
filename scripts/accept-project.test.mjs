import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("accepting a quote creates a project and does not move stock", () => {
  const source = readFileSync(new URL("../src/modules/quotes/usecases.ts", import.meta.url), "utf8");
  const accept = source.slice(source.indexOf("export async function acceptQuote"));
  assert.match(accept, /createFromAcceptedQuote/);
  assert.doesNotMatch(accept, /stock_|articles\.issue|articles\.receive/);
  const projects = readFileSync(new URL("../src/modules/projects/usecases.ts", import.meta.url), "utf8");
  const created = projects.slice(projects.indexOf("export async function createFromAcceptedQuote"));
  assert.match(created, /quote_line/);
  assert.match(created, /if \(!line\.articleId\) continue/);
  assert.doesNotMatch(created, /stock_/);
});
