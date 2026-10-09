import assert from "node:assert/strict";
import test from "node:test";
import { lateMaterials, type Incoming, type MaterialNeed, type Shelf } from "./coverage.ts";

const today = "2026-10-09";

function need(partial: Partial<MaterialNeed> & Pick<MaterialNeed, "qtyRemaining" | "earliestDate">): MaterialNeed {
  return {
    articleId: "plaat",
    projectId: "dak",
    projectName: "Dak",
    description: "Plaat",
    unit: "stuk",
    ...partial,
  };
}

test("overdue purchases do not cover a job, and earlier jobs take the shelf", () => {
  const shelves: Shelf[] = [{ articleId: "plaat", onHand: "2" }];
  const incoming: Incoming[] = [
    { articleId: "plaat", qtyOpen: "10", expectedOn: "2026-10-01" },
    { articleId: "plaat", qtyOpen: "3", expectedOn: "2026-10-10" },
  ];
  const late = lateMaterials(
    [
      need({ projectId: "dak", projectName: "Dak", qtyRemaining: "4", earliestDate: "2026-10-10" }),
      need({
        projectId: "gevel",
        projectName: "Gevel",
        qtyRemaining: "3",
        earliestDate: "2026-10-12",
      }),
    ],
    shelves,
    incoming,
    today,
  );
  assert.equal(late.length, 1);
  assert.equal(late[0]?.projectId, "gevel");
  assert.equal(late[0]?.qtyShort, "2");
});

test("a purchase after the job does not count", () => {
  const late = lateMaterials(
    [need({ qtyRemaining: "1", earliestDate: "2026-10-10" })],
    [{ articleId: "plaat", onHand: "0" }],
    [{ articleId: "plaat", qtyOpen: "5", expectedOn: "2026-10-11" }],
    today,
  );
  assert.equal(late.length, 1);
  assert.equal(late[0]?.qtyShort, "1");
});
