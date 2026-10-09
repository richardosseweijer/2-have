const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatEur(cents: number): string {
  return euro.format(cents / 100);
}

export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole},${frac}`;
}

/** Parse a Dutch or plain euro amount into integer cents. Null when invalid. */
export function parseEurosToCents(input: string): number | null {
  const raw = input.trim().replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

export function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Ongeldig getal.");
  return parsed;
}

export function formatQty(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 3 }).format(parsed);
}

/** Dutch or plain quantity, up to 3 decimals. Canonical numeric string, or null. */
export function parseQty(input: string): string | null {
  const raw = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  const head = String(Number(whole));
  const tail = frac.replace(/0+$/, "");
  return tail.length > 0 ? `${head}.${tail}` : head;
}

/** Sell price in cents. Markup is basis points: 3500 = 35% on top of cost. */
export function applyMarkup(costCents: number, markupBps: number): number {
  return Math.round((costCents * (10_000 + markupBps)) / 10_000);
}

/** Basis points so the typed sell price is kept. Null when cost is zero. */
export function markupBpsFromPrices(costCents: number, sellCents: number): number | null {
  if (costCents <= 0) return null;
  return Math.round(((sellCents - costCents) * 10_000) / costCents);
}

export function bpsToInput(bps: number): string {
  const negative = bps < 0;
  const abs = Math.abs(bps);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const tail = frac === 0 ? "" : frac % 10 === 0 ? `,${frac / 10}` : `,${String(frac).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${whole}${tail}`;
}

/** Percent text to basis points. Null when it is not a percent with at most two decimals. */
export function parsePercentToBps(input: string): number | null {
  const raw = input.trim().replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) return null;
  const negative = raw.startsWith("-");
  const [whole, frac = ""] = raw.slice(negative ? 1 : 0).split(".");
  let bps = Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
  if (negative) bps = -bps;
  if (bps < -10_000 || bps > 100_000) return null;
  return bps;
}
