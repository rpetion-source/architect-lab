import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS, runScenario } from "../data/scenarios/registry.ts";

// Résultat attendu de chaque configuration guidée : [issue, règle décisive, objectif atteint].
const EXPECT: Record<string, Record<string, [string, string | null, boolean | null]>> = {
  "finance-d365": { A: ["obtained", null, true], B: ["obtained", null, false], C: ["obtained", null, true], D: ["obtained", null, false], E: ["obtained", null, false] },
  "sales-dataverse": { A: ["obtained", null, true], B: ["obtained", null, true], C: ["obtained", null, false], D: ["indeterminate", "CRM-COL-KNOW", null], E: ["obtained", null, false], F: ["blocked-before-runtime", "CRM-DLP", true] },
  "docs-sharepoint": { A: ["obtained", null, true], B: ["obtained", null, false], C: ["refused", "DOC-RCD-HIDE", true], D: ["obtained", null, false], E: ["indeterminate", "DOC-RCD-RECENT", null], F: ["refused", "DOC-DLP", true] },
  invoices: { A: ["obtained", null, true], B: ["refused", "INV-REJECT", true], C: ["obtained", null, false], D: ["refused", "INV-REJECT", true], E: ["obtained", null, false], F: ["obtained", null, false] },
  "external-model": { A: ["obtained", null, true], B: ["obtained", null, true], C: ["blocked-before-runtime", "EXT-RES-ANTH", true], D: ["obtained", null, false], E: ["refused", "EXT-EDLP", true], F: ["obtained", null, false] },
};

for (const [id, presets] of Object.entries(EXPECT)) {
  test(`${id} : chaque configuration guidée donne le résultat attendu`, () => {
    const s = SCENARIOS.find((x) => x.scenario.id === id)!.scenario;
    assert.equal(s.presets.length, Object.keys(presets).length);
    for (const p of s.presets) {
      const [outcome, rule, met] = presets[p.id]!;
      const r = runScenario(id, p.params);
      assert.deepEqual([r.outcome, r.decisiveRuleId, r.objective.met], [outcome, rule, met], `${id}/${p.id}`);
    }
  });
}

const all = (id: string) => {
  const s = SCENARIOS.find((x) => x.scenario.id === id)!.scenario;
  const out: ReturnType<typeof runScenario>[] = [];
  const rec = (i: number, acc: Record<string, string>) => {
    const p = s.parameters[i];
    if (!p) { out.push(runScenario(id, acc)); return; }
    for (const o of p.options) rec(i + 1, { ...acc, [p.id]: o.value });
  };
  rec(0, {});
  return out;
};

test("Finance invariant : une fuite vient d'un compte du maker, d'un Contributor ou d'un rôle OneLake sans RLS", () => {
  for (const r of all("finance-d365")) if (r.outcome === "obtained" && r.facts.exceedsLegit) {
    assert.ok(r.facts.principalKind === "maker" || r.facts.bypass === true || r.facts.fabricRls === "none", JSON.stringify(r.params));
  }
});
test("Commercial invariant : Sam n'obtient jamais rien avec sa propre identité", () => {
  for (const r of all("sales-dataverse")) if (r.facts.user === "sam" && r.facts.principalKind === "user") assert.notEqual(r.outcome, "obtained");
});
test("Documentaire invariant : Julie ne lit le contentieux que par le lien « Tout le monde »", () => {
  for (const r of all("docs-sharepoint")) if (r.outcome === "obtained" && r.facts.exceedsLegit) assert.equal(r.facts.overshare, "link");
});
test("Factures invariant : une facture frauduleuse ne passe qu'avec un contrôle humain défaillant ou contourné", () => {
  for (const r of all("invoices")) if (r.outcome === "obtained" && r.facts.anomaly) {
    assert.ok(r.facts.checksSkipped === true || r.facts.approval === "none" || r.facts.approver !== "careful" || r.facts.catchable === false, JSON.stringify(r.params));
  }
});
test("Modèle externe invariant : avec exigence UE, Claude hébergé chez Anthropic n'est jamais mis en production", () => {
  for (const r of all("external-model")) if (r.facts.model === "claude-anthropic" && r.facts.residency === "eu") assert.notEqual(r.outcome, "obtained");
});

test("chaque configuration guidée a une question « Et si… ? » en langage courant", () => {
  for (const { scenario: s } of SCENARIOS) {
    for (const p of s.presets) assert.ok(p.question && p.question.length > 10, `${s.id}/${p.id}`);
    assert.match(s.presets[0]!.question!, /^Situation de départ/, s.id);
  }
});
