import { describe, expect, it } from "vitest";
import type { KnowledgeItem } from "../src/lib/api.ts";
import { groupKnowledge } from "../src/lib/knowledge.ts";

const item = (over: Partial<KnowledgeItem>): KnowledgeItem =>
  ({ id: "k-1", kind: "document", title: "Doc", scope: "relevant", status: "ready", ...over }) as KnowledgeItem;

describe("the built-in AI City guide in Knowledge", () => {
  it("always comes first, in its own Built in group", () => {
    const groups = groupKnowledge([
      item({ id: "k-2", title: "Tax law", jurisdictions: ["SE"], year: 2026, topic: "tax" }),
      item({ id: "kn-builtin-guide", title: "AI City guide", builtin: true }),
      item({ id: "k-3", title: "Notes" }),
    ]);
    expect(groups[0]).toMatchObject({ key: "builtin", label: "Built in" });
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["kn-builtin-guide"]);
    expect(groups.flatMap((g) => g.items).filter((i) => i.builtin)).toHaveLength(1);
  });
});
