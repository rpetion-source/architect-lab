import { test } from "node:test";
import assert from "node:assert/strict";
import { missionAchieved } from "../lib/policy-engine/engine.ts";
import { SCENARIOS, runScenario } from "../data/scenarios/registry.ts";
import type { ParamValues, ScenarioDef, SimulationResult } from "../lib/types/index.ts";

function* combos(s: ScenarioDef, i = 0, acc: ParamValues = {}): Generator<ParamValues> {
  const p = s.parameters[i];
  if (!p) { yield { ...acc }; return; }
  for (const o of p.options) yield* combos(s, i + 1, { ...acc, [p.id]: o.value });
}
const all = (id: string) => {
  const e = SCENARIOS.find((x) => x.scenario.id === id)!;
  return [...combos(e.scenario)].map((p) => runScenario(id, p));
};
const cache = new Map<string, SimulationResult[]>();
const runs = (id: string) => { if (!cache.has(id)) cache.set(id, all(id)); return cache.get(id)!; };
const preset = (id: string, pid: string) => SCENARIOS.find((x) => x.scenario.id === id)!.scenario.presets.find((p) => p.id === pid)!.params;
const step = (r: SimulationResult, id: string) => r.steps.find((s) => s.stepId === id)!;
const F = (pid: string, extra: Partial<ParamValues> = {}) => runScenario("fabric-rls", { ...preset("fabric-rls", pid), ...extra });
const M = (pid: string, extra: Partial<ParamValues> = {}) => runScenario("foundry-mcp", { ...preset("foundry-mcp", pid), ...extra });

// ---------------- Intégrité de tous les scénarios
for (const { scenario: s } of SCENARIOS) {
  test(`${s.id} : intégrité des données et des références`, () => {
    const ids = s.rules.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
    const steps = new Set(s.steps.map((x) => x.id)), nodes = new Set(s.nodes.map((n) => n.id)), edges = new Set(s.edges.map((e) => e.id));
    for (const r of s.rules) {
      assert.ok(steps.has(r.stepId), r.id);
      assert.match(r.ref.url, /^https:\/\/(learn|www)\.microsoft\.com\//, r.id);
      if (r.confidence === "low") assert.notEqual(r.decision, "deny", `${r.id} : confiance faible ne peut pas refuser`);
    }
    for (const e of s.edges) assert.ok(nodes.has(e.from) && nodes.has(e.to), e.id);
    for (const st of s.steps) { st.nodeIds.forEach((n) => assert.ok(nodes.has(n), n)); st.edgeIds.forEach((e) => assert.ok(edges.has(e), e)); }
  });

  test(`${s.id} : toutes les combinaisons s'évaluent, avec un récit`, () => {
    const rs = runs(s.id);
    assert.ok(rs.length > 100);
    for (const r of rs) { assert.equal(r.steps.length, s.steps.length); assert.ok(r.story.length >= 2); }
  });

  test(`${s.id} : chaque défi est réalisable et aucun n'est gagné par défaut`, () => {
    const rs = runs(s.id);
    const def = runScenario(s.id, {});
    for (const m of s.missions) {
      assert.ok(rs.some((r) => missionAchieved(r, m)), `${m.id} irréalisable`);
      assert.equal(missionAchieved(def, m), false, `${m.id} gagné sans rien faire`);
    }
  });
}

// ---------------- Fabric
test("Fabric A — Nadia voit 2 lignes Nord, sans marge ni e-mail", () => {
  const r = F("A");
  assert.equal(r.outcome, "obtained");
  assert.deepEqual(r.table!.rows.filter((x) => x.visible).map((x) => x.id), ["r1", "r2"]);
  assert.deepEqual(r.table!.columns.filter((c) => c.visible).map((c) => c.name), ["Région", "Client", "Montant"]);
  assert.equal(r.objective.met, true);
});
test("Fabric B — principal de service Contributor : RLS/CLS contournées", () => {
  const r = F("B");
  assert.equal(r.outcome, "obtained");
  assert.equal(step(r, "control-plane").risk, "critical");
  assert.equal(r.table!.rows.filter((x) => x.visible).length, 6);
  assert.equal(r.objective.met, false);
});
test("Fabric C — select * via SQL avec CLS : erreur, requête légitime bloquée", () => {
  const r = F("C");
  assert.equal(r.decisiveRuleId, "FAB-SQL-STAR");
  assert.equal(r.objective.met, false);
});
test("Fabric D — même select * en Spark : e-mail retiré, objectif atteint", () => {
  const r = F("D");
  assert.equal(r.outcome, "obtained");
  assert.equal(r.table!.columns.find((c) => c.name === "E-mail client")!.visible, false);
  assert.equal(r.objective.met, true);
});
test("Fabric E — RLS et CLS dans deux rôles : erreur (FAB-SPLIT)", () => assert.equal(F("E").decisiveRuleId, "FAB-SPLIT"));
test("Fabric F — DefaultReader oublié : Nadia voit les marges", () => {
  const r = F("F");
  assert.equal(r.outcome, "obtained");
  assert.equal(step(r, "data-plane").risk, "critical");
  assert.equal(r.objective.met, false);
});
test("Fabric — Nadia et la colonne Marge : refus CLS, objectif atteint", () => {
  const r = F("A", { question: "marges" });
  assert.equal(r.decisiveRuleId, "FAB-CLS-COL");
  assert.equal(r.objective.met, true);
});
test("Fabric — principaux de service interdits : jeton refusé", () => assert.equal(F("B", { spnSetting: "disabled" }).decisiveRuleId, "FAB-SPN-OFF"));
test("Fabric — moteur tiers non autorisé bloque, autorisé est conditionnel (Preview)", () => {
  assert.equal(F("A", { engine: "ext-unauthorized" }).decisiveRuleId, "FAB-EXT-BLOCK");
  assert.equal(step(F("A", { engine: "ext-authorized" }), "engine").decision, "conditional");
});
test("Fabric — Léa via moteur tiers : Indéterminé, jamais un refus garanti", () => {
  assert.equal(runScenario("fabric-rls", { user: "lea", engine: "ext-unauthorized" }).outcome, "indeterminate");
});
test("Fabric — règle RLS invalide : table bloquée", () => assert.equal(F("A", { rlsSyntax: "error" }).decisiveRuleId, "FAB-RLS-ERR"));
test("Fabric invariant : une fuite vient toujours d'un rôle Contributor ou de DefaultReader", () => {
  for (const r of runs("fabric-rls")) {
    if (r.outcome === "obtained" && r.facts.exceedsLegit) {
      assert.ok(r.facts.bypassIllegit === true || r.facts.defaultReaderGrant === true, JSON.stringify(r.params));
    }
    if (r.outcome !== "obtained") assert.equal(r.table!.rows.some((x) => x.visible), false);
  }
});

// ---------------- Foundry + MCP
test("MCP A — lecture autorisée exécutée", () => { const r = M("A"); assert.equal(r.outcome, "obtained"); assert.equal(r.objective.met, true); });
test("MCP B — ressource interdite : l'ERP refuse avec l'identité de Marc", () => {
  const r = M("B"); assert.equal(r.decisiveRuleId, "MCP-SRV-DENY"); assert.equal(r.objective.met, true);
});
test("MCP C — clé partagée : la ressource interdite fuite", () => {
  const r = M("C"); assert.equal(r.outcome, "obtained"); assert.equal(step(r, "server-authz").risk, "critical"); assert.equal(r.objective.met, false);
});
test("MCP D — écriture : approbation demandée puis refusée", () => assert.equal(M("D").decisiveRuleId, "MCP-APPR-REJ"));
test("MCP E — exfiltration sans contrôle : exécutée", () => { const r = M("E"); assert.equal(r.outcome, "obtained"); assert.equal(r.objective.met, false); });
test("MCP F — injection : l'agent exfiltre les IBAN", () => {
  const r = M("F");
  assert.equal(step(r, "induced").risk, "critical");
  assert.equal(r.objective.met, false);
  assert.ok(r.story.some((s) => s.tone === "attack"));
});
test("MCP G — lecture seule : l'injection échoue faute d'outil", () => {
  const r = M("G"); assert.equal(r.decisiveRuleId, "MCP-IND-NOTOOL"); assert.equal(r.objective.met, true);
});
test("MCP — garde-fou Tool response sur MCP : Indéterminé", () => {
  const r = M("F", { guardrail: "indirect-block" });
  assert.equal(step(r, "tool-response").decision, "indeterminate");
  assert.equal(r.outcome, "indeterminate");
});
test("MCP — injection + réviseur attentif : lecture servie, exfiltration refusée", () => {
  const r = M("F", { approval: "always", human: "careful" });
  assert.equal(r.decisiveRuleId, "MCP-IND-REJ");
  assert.equal(r.objective.met, true);
});
test("MCP — réviseur qui approuve tout : l'injection passe malgré l'approbation", () => {
  const r = M("F", { approval: "always", human: "approve-all" });
  assert.equal(r.outcome, "obtained"); assert.equal(r.objective.met, false);
});
test("MCP — réviseur qui refuse tout : sécurisé mais lecture légitime bloquée", () => {
  const r = M("A", { approval: "always", human: "reject-all" });
  assert.equal(r.objective.met, false);
});
test("MCP — Sophie modifie un IBAN avec approbation : légitime", () => {
  const r = runScenario("foundry-mcp", { user: "sophie", action: "write", approval: "always", human: "careful" });
  assert.equal(r.outcome, "obtained"); assert.equal(r.objective.met, true);
});
test("MCP invariant : une ressource interdite n'est servie qu'avec une clé partagée", () => {
  for (const r of runs("foundry-mcp")) {
    if (r.outcome === "obtained" && r.facts.userAllowed === false) assert.equal(r.facts.mcpAuth, "shared-key", JSON.stringify(r.params));
    if (r.outcome === "obtained" && r.facts.action === "injection") assert.equal(r.facts.allowedTools, "all");
  }
});
