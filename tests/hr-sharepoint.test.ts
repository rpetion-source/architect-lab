import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diffResults, evaluateCondition, matchRules, mostRestrictive, renderTemplate, resolveParams,
} from "../lib/policy-engine/engine.ts";
import { hrSharePointScenario as S, simulateHr } from "../data/scenarios/hr-sharepoint/index.ts";
import type { ParamValues } from "../lib/types/index.ts";

const preset = (id: string) => {
  const p = S.presets.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p.params;
};
const step = (res: ReturnType<typeof simulateHr>, id: string) => {
  const s = res.steps.find((x) => x.stepId === id);
  if (!s) throw new Error(id);
  return s;
};

// ---------------- Moteur générique
test("conditions : all / any / not / eq / in", () => {
  const f = { a: "x", b: true };
  assert.equal(evaluateCondition({ all: [{ eq: ["a", "x"] }, { eq: ["b", true] }] }, f), true);
  assert.equal(evaluateCondition({ any: [{ eq: ["a", "y"] }, { in: ["a", ["x", "z"]] }] }, f), true);
  assert.equal(evaluateCondition({ not: { eq: ["b", true] } }, f), false);
  assert.equal(evaluateCondition({ all: [] }, f), true);
});

test("une règle qui cite un fait inconnu échoue bruyamment", () => {
  assert.throws(() => evaluateCondition({ eq: ["inconnu", true] }, {}), /Fait inconnu/);
});

test("un gabarit inconnu échoue bruyamment", () => {
  assert.throws(() => renderTemplate("{absent}", {}), /Gabarit inconnu/);
});

test("la décision la plus restrictive l'emporte", () => {
  assert.equal(mostRestrictive(["allow", "observed", "deny"]), "deny");
  assert.equal(mostRestrictive(["allow", "indeterminate"]), "indeterminate");
  assert.equal(mostRestrictive([]), "not-applicable");
});

test("paramètres : valeur invalide et paramètre inconnu refusés", () => {
  assert.throws(() => resolveParams(S, { user: "mallory" }), /invalide/);
  assert.throws(() => resolveParams(S, { inconnu: "x" } as Partial<ParamValues>), /inconnu/);
});

test("les règles par défaut ne jouent qu'en l'absence de règle spécifique", () => {
  const facts = simulateHr(preset("C")).facts;
  const ids = matchRules(S.rules, "governance", facts).map((r) => r.id);
  assert.deepEqual(ids, ["PP-01"]);
});

test("déterminisme : mêmes paramètres, même résultat", () => {
  assert.deepEqual(simulateHr(preset("B")), simulateHr(preset("B")));
});

// ---------------- Intégrité des données
test("intégrité : identifiants uniques, étapes et nœuds référencés existent", () => {
  const ruleIds = S.rules.map((r) => r.id);
  assert.equal(new Set(ruleIds).size, ruleIds.length);
  const stepIds = new Set(S.steps.map((s) => s.id));
  const nodeIds = new Set(S.nodes.map((n) => n.id));
  const edgeIds = new Set(S.edges.map((e) => e.id));
  for (const r of S.rules) assert.ok(stepIds.has(r.stepId), r.id);
  for (const e of S.edges) assert.ok(nodeIds.has(e.from) && nodeIds.has(e.to), e.id);
  for (const s of S.steps) {
    for (const n of s.nodeIds) assert.ok(nodeIds.has(n), `${s.id}:${n}`);
    for (const e of s.edgeIds) assert.ok(edgeIds.has(e), `${s.id}:${e}`);
  }
});

test("intégrité : chaque règle cite une page Microsoft Learn datée", () => {
  for (const r of S.rules) {
    assert.match(r.ref.url, /^https:\/\/learn\.microsoft\.com\//, r.id);
    assert.match(r.lastVerified, /^\d{4}-\d{2}-\d{2}$/, r.id);
  }
});

test("une règle à faible confiance ne produit jamais un refus", () => {
  for (const r of S.rules.filter((x) => x.confidence === "low")) assert.notEqual(r.decision, "deny", r.id);
});

// ---------------- Propriété exhaustive (toutes les combinaisons de paramètres)
function* combinations(i = 0, acc: ParamValues = {}): Generator<ParamValues> {
  const p = S.parameters[i];
  if (!p) { yield { ...acc }; return; }
  for (const o of p.options) yield* combinations(i + 1, { ...acc, [p.id]: o.value });
}

test("exhaustif : aucune combinaison ne lève d'erreur ; invariant de sécurité tenu", () => {
  let n = 0;
  for (const params of combinations()) {
    const res = simulateHr(params);
    n++;
    assert.equal(res.steps.length, S.steps.length);
    if (res.outcome === "obtained" && res.facts.userLegit === false) {
      // Une fuite n'est possible qu'à cause d'une mauvaise configuration identifiée.
      assert.ok(res.facts.overshare === "everyone" || res.facts.principalKind === "maker",
        JSON.stringify(params));
    }
    if (res.outcome === "blocked-before-runtime") {
      assert.equal(step(res, "audit").decision, "not-applicable");
    }
  }
  assert.ok(n > 10_000, `${n} combinaisons`);
});

// ---------------- Scénarios What-if
test("A — Alice, source déléguée : refus à la source (SP-01)", () => {
  const res = simulateHr(preset("A"));
  assert.equal(res.outcome, "refused");
  assert.equal(res.decisiveRuleId, "SP-01");
  assert.equal(res.decisiveControl, "source-authorization");
  assert.equal(res.objective.met, true);
  assert.equal(step(res, "data-protection").decision, "not-applicable");
});

test("B — identifiants du maker, étiquette non chiffrée : fuite", () => {
  const res = simulateHr(preset("B"));
  assert.equal(res.outcome, "obtained");
  assert.equal(res.facts.principalKind, "maker");
  assert.equal(step(res, "identity").risk, "high");
  assert.equal(res.objective.met, false);
});

test("B′ — identifiants du maker interdits : retour à l'identité d'Alice, refus", () => {
  const res = simulateHr(preset("B2"));
  assert.equal(res.facts.principalKind, "user");
  assert.ok(step(res, "governance").matched.some((m) => m.ruleId === "PP-05"));
  assert.equal(res.decisiveRuleId, "SP-01");
});

test("C — connecteur SharePoint bloqué : non publiable, étapes suivantes grises", () => {
  const res = simulateHr(preset("C"));
  assert.equal(res.outcome, "blocked-before-runtime");
  assert.equal(res.decisiveRuleId, "PP-01");
  assert.equal(step(res, "source-authz").decision, "not-applicable");
  assert.match(step(res, "source-authz").skippedBecause ?? "", /non publiable/);
});

test("D — nœud HTTP externe : contenu obtenu puis exfiltrable (risque critique)", () => {
  const res = simulateHr(preset("D"));
  assert.equal(res.outcome, "obtained");
  assert.equal(step(res, "output").risk, "critical");
  assert.equal(res.objective.met, false);
});

test("D bis — connecteur HTTP bloqué : publication impossible (PP-03)", () => {
  const res = simulateHr({ ...preset("D"), httpPolicy: "blocked" });
  assert.equal(res.outcome, "blocked-before-runtime");
  assert.equal(res.decisiveRuleId, "PP-03");
});

test("E — surpartage, DLP active dans Teams : refus par DLP-01", () => {
  const res = simulateHr(preset("E"));
  assert.equal(step(res, "source-authz").risk, "critical");
  assert.equal(res.decisiveRuleId, "DLP-01");
  assert.equal(res.decisiveControl, "data-loss-prevention");
});

test("E bis — même configuration sur site web : DLP hors périmètre, fuite", () => {
  const res = simulateHr({ ...preset("E"), channel: "website", agentAuth: "manual" });
  assert.ok(step(res, "data-protection").matched.some((m) => m.ruleId === "DLP-02"));
  assert.equal(res.outcome, "obtained");
  assert.equal(res.objective.met, false);
});

test("surpartage + étiquette chiffrée : SharePoint autorise, le chiffrement refuse (MIP-01)", () => {
  const res = simulateHr({ user: "alice", request: "salaires", overshare: "everyone" });
  assert.equal(step(res, "source-authz").decision, "allow");
  assert.equal(res.decisiveRuleId, "MIP-01");
});

test("fichier chiffré lu par un outil connecteur : Indéterminé, jamais un refus garanti", () => {
  const res = simulateHr({ user: "bruno", request: "salaires", path: "connector-user" });
  assert.equal(res.outcome, "indeterminate");
  assert.equal(res.decisiveRuleId, "MIP-02");
  assert.equal(res.objective.met, null);
});

test("Bruno (RH) obtient les salaires par la voie nominale", () => {
  const res = simulateHr({ user: "bruno", request: "salaires" });
  assert.equal(res.outcome, "obtained");
  assert.equal(res.objective.met, true);
});

test("DLP active : Bruno est aussi bloqué — compromis métier signalé", () => {
  const res = simulateHr({ user: "bruno", request: "salaires", dlp: "on" });
  assert.equal(res.decisiveRuleId, "DLP-01");
  assert.equal(res.objective.met, false);
  assert.match(res.objective.explanation, /objectif métier non atteint/);
});

test("document Général : aucune protection Purview restrictive (DP-00)", () => {
  const res = simulateHr({ user: "alice", request: "conges" });
  assert.equal(res.outcome, "obtained");
  assert.deepEqual(step(res, "data-protection").matched.map((m) => m.ruleId), ["DP-00"]);
});

test("agent sans authentification + politique : non publiable (AUTH-01)", () => {
  const res = simulateHr({ agentAuth: "none", authPolicy: "require" });
  assert.equal(res.outcome, "blocked-before-runtime");
  assert.equal(res.decisiveRuleId, "AUTH-01");
});

test("agent sans authentification : aucune récupération, l'audit observe encore", () => {
  const res = simulateHr({ agentAuth: "none" });
  assert.equal(res.decisiveRuleId, "AUTH-02");
  assert.equal(step(res, "audit").decision, "observed");
});

test("« Authenticate with Microsoft » sur site web : non publiable (AUTH-03)", () => {
  const res = simulateHr({ channel: "website" });
  assert.equal(res.decisiveRuleId, "AUTH-03");
});

test("canal site web : audit conditionné à la facturation à l'usage", () => {
  const res = simulateHr({ user: "bruno", request: "salaires", channel: "website", agentAuth: "manual" });
  assert.equal(step(res, "audit").decision, "conditional");
  assert.ok(res.auditEvents.some((e) => /facturation/.test(e)));
});

test("diff A → B : le changement de résultat est expliqué", () => {
  const d = diffResults(simulateHr(preset("A")), simulateHr(preset("B")));
  assert.equal(d.outcomeBefore, "refused");
  assert.equal(d.outcomeAfter, "obtained");
  assert.ok(d.changedSteps.some((s) => s.stepId === "source-authz"));
  assert.match(d.summary, /Accès refusé → Contenu obtenu/);
});
