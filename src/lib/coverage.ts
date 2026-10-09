export type MaterialNeed = {
  articleId: string;
  projectId: string;
  projectName: string;
  description: string;
  unit: string;
  qtyRemaining: string;
  earliestDate: string;
};

export type Shelf = {
  articleId: string;
  onHand: string;
};

export type Incoming = {
  articleId: string;
  qtyOpen: string;
  expectedOn: string;
};

export type LateMaterial = MaterialNeed & {
  qtyShort: string;
};

function qty(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function qtyText(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * A need is late when the shelf, plus goods expected on or before the job,
 * cannot cover what that project still has to issue. An overdue purchase does
 * not count: it was supposed to be here already. Earlier jobs take stock first.
 */
export function lateMaterials(
  needs: MaterialNeed[],
  shelves: Shelf[],
  incoming: Incoming[],
  today: string,
): LateMaterial[] {
  const shelf = new Map<string, number>();
  for (const row of shelves) shelf.set(row.articleId, qty(row.onHand));
  const receipts = new Map<string, { date: string; qty: number }[]>();
  for (const row of incoming) {
    const list = receipts.get(row.articleId) ?? [];
    list.push({ date: row.expectedOn, qty: qty(row.qtyOpen) });
    receipts.set(row.articleId, list);
  }
  for (const list of receipts.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const ordered = [...needs].sort(
    (a, b) => a.earliestDate.localeCompare(b.earliestDate) || a.projectName.localeCompare(b.projectName),
  );
  const late: LateMaterial[] = [];
  for (const need of ordered) {
    const onHand = shelf.get(need.articleId) ?? 0;
    const lines = receipts.get(need.articleId) ?? [];
    const inTime = (date: string) => date >= today && date <= need.earliestDate;
    let available = Math.max(onHand, 0);
    for (const line of lines) {
      if (inTime(line.date)) available += line.qty;
    }
    const want = qty(need.qtyRemaining);
    const covered = Math.min(available, want);
    let left = covered;
    const fromShelf = Math.min(Math.max(onHand, 0), left);
    shelf.set(need.articleId, onHand - fromShelf);
    left -= fromShelf;
    for (const line of lines) {
      if (left <= 0) break;
      if (!inTime(line.date)) continue;
      const take = Math.min(line.qty, left);
      line.qty -= take;
      left -= take;
    }
    const short = want - covered;
    if (short > 0.0005) late.push({ ...need, qtyShort: qtyText(short) });
  }
  return late;
}
