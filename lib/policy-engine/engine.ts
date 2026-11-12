import type {
  Condition, Decision, Facts, MatchedRule, Mission, Outcome, ParamValues, ResultDiff,
  RiskLevel, Rule, ScenarioDef, SimulationResult, StepResult,
} from "../types/index.ts";

/** Ordre de restriction : la décision la plus restrictive l'emporte dans une étape. */
const DECISION_RANK: Record<Decision, number> = {
  deny: 5, indeterminate: 4, conditional: 3, allow: 2, observed: 1, "not-applicable": 0,
};
const RISK_RANK: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

export function evaluateCondition(cond: Condition, facts: Facts): boolean {
  if ("all" in cond) return cond.all.every((c) => evaluateCondition(c, facts));
  if ("any" in cond) return cond.any.some((c) => evaluateCondition(c, facts));
  if ("not" in cond) return !evaluateCondition(cond.not, facts);
  if ("eq" in cond) {
    const [key, value] = cond.eq;
    assertKnownFact(key, facts);
    return facts[key] === value;
  }
  const [key, values] = cond.in;
  assertKnownFact(key, facts);
  return values.includes(facts[key] as never);
}

function assertKnownFact(key: string, facts: Facts): void {
  if (!(key in facts)) throw new Error(`Fait inconnu dans une règle : "${key}"`);
}

export function renderTemplate(text: string, facts: Facts): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in facts)) throw new Error(`Gabarit inconnu : {${k}}`);
    return String(facts[k]);
  });
}

export function mostRestrictive(decisions: Decision[]): Decision {
  return decisions.reduce<Decision>(
    (acc, d) => (DECISION_RANK[d] > DECISION_RANK[acc] ? d : acc), "not-applicable");
}

function maxRisk(risks: RiskLevel[]): RiskLevel {
  return risks.reduce<RiskLevel>((acc, r) => (RISK_RANK[r] > RISK_RANK[acc] ? r : acc), "none");
}

function toMatched(rule: Rule, facts: Facts): MatchedRule {
  return {
    ruleId: rule.id, decision: rule.decision, risk: rule.risk,
    rationale: renderTemplate(rule.rationale, facts),
    controlKind: rule.controlKind, product: rule.product,
    confidence: rule.confidence, ref: rule.ref,
  };
}

/** Règles d'une étape retenues pour ces faits (les règles par défaut ne jouent qu'en dernier recours). */
export function matchRules(rules: Rule[], stepId: string, facts: Facts): Rule[] {
  const inStep = rules.filter((r) => r.stepId === stepId).sort((a, b) => a.priority - b.priority);
  const specific = inStep.filter((r) => !r.fallback && evaluateCondition(r.when, facts));
  if (specific.length > 0) return specific;
  return inStep.filter((r) => r.fallback && evaluateCondition(r.when, facts));
}

export type FactDeriver = (scenario: ScenarioDef, params: ParamValues) => Facts;

export function resolveParams(scenario: ScenarioDef, partial: Partial<ParamValues>): ParamValues {
  const out: ParamValues = {};
  for (const p of scenario.parameters) {
    const v = partial[p.id] ?? p.default;
    if (!p.options.some((o) => o.value === v)) {
      throw new Error(`Valeur "${v}" invalide pour le paramètre "${p.id}"`);
    }
    out[p.id] = v;
  }
  for (const key of Object.keys(partial)) {
    if (!scenario.parameters.some((p) => p.id === key)) throw new Error(`Paramètre inconnu : "${key}"`);
  }
  return out;
}

export interface OutcomeSummarizer {
  (args: { scenario: ScenarioDef; facts: Facts; steps: StepResult[]; outcome: Outcome }): Pick<
    SimulationResult, "obtained" | "refused" | "auditEvents" | "objective" | "residualRisks" | "story" | "table">;
}

export function simulate(
  scenario: ScenarioDef,
  partialParams: Partial<ParamValues>,
  derive: FactDeriver,
  summarize: OutcomeSummarizer,
): SimulationResult {
  const params = resolveParams(scenario, partialParams);
  const facts = derive(scenario, params);
  const steps: StepResult[] = [];
  let stop: { kind: "pre" | "runtime"; ruleId: string; stepTitle: string } | null = null;
  let decisive: Rule | null = null;
  let firstIndeterminate: Rule | null = null;

  for (const step of [...scenario.steps].sort((a, b) => a.order - b.order)) {
    const base = { stepId: step.id, title: step.title, nodeIds: step.nodeIds, edgeIds: step.edgeIds };
    const skip = stop && (stop.kind === "pre" || !step.observesAfterDeny);
    if (skip && stop) {
      steps.push({
        ...base, decision: "not-applicable", risk: "none", matched: [],
        skippedBecause: stop.kind === "pre"
          ? `Agent non publiable : blocage à l'étape « ${stop.stepTitle} » (${stop.ruleId}).`
          : `Parcours interrompu à l'étape « ${stop.stepTitle} » (${stop.ruleId}).`,
      });
      continue;
    }
    const rules = matchRules(scenario.rules, step.id, facts);
    const matched = rules.map((r) => toMatched(r, facts));
    const decision = mostRestrictive(matched.map((m) => m.decision));
    steps.push({ ...base, decision, risk: maxRisk(matched.map((m) => m.risk)), matched });

    const denyRule = rules.find((r) => r.decision === "deny");
    if (!stop && denyRule && (denyRule.preRuntime || denyRule.stopsRuntime)) {
      stop = { kind: denyRule.preRuntime ? "pre" : "runtime", ruleId: denyRule.id, stepTitle: step.title };
      decisive = denyRule;
    }
    const indet = rules.find((r) => r.decision === "indeterminate");
    if (!stop && indet && !firstIndeterminate) firstIndeterminate = indet;
  }

  let outcome: Outcome;
  if (stop?.kind === "pre") outcome = "blocked-before-runtime";
  else if (stop?.kind === "runtime") outcome = "refused";
  else if (firstIndeterminate) { outcome = "indeterminate"; decisive = firstIndeterminate; }
  else outcome = "obtained";

  return {
    scenarioId: scenario.id, params, facts, steps, outcome,
    decisiveRuleId: decisive?.id ?? null,
    decisiveControl: decisive?.controlKind ?? null,
    ...summarize({ scenario, facts, steps, outcome }),
  };
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  obtained: "Contenu obtenu",
  refused: "Accès refusé",
  "blocked-before-runtime": "Bloqué avant exécution",
  indeterminate: "Indéterminé",
};

export function diffResults(
  before: SimulationResult, after: SimulationResult, labels: Partial<Record<Outcome, string>> = {},
): ResultDiff {
  const label = (o: Outcome) => labels[o] ?? OUTCOME_LABEL[o];
  const changedSteps = after.steps.flatMap((s) => {
    const prev = before.steps.find((p) => p.stepId === s.stepId);
    return prev && prev.decision !== s.decision
      ? [{ stepId: s.stepId, title: s.title, before: prev.decision, after: s.decision }] : [];
  });
  const parts: string[] = [];
  if (before.outcome !== after.outcome) {
    parts.push(`Résultat : ${label(before.outcome)} → ${label(after.outcome)}.`);
  } else parts.push(`Résultat inchangé : ${label(after.outcome)}.`);
  if (before.decisiveRuleId !== after.decisiveRuleId) {
    parts.push(`Règle décisive : ${before.decisiveRuleId ?? "aucune"} → ${after.decisiveRuleId ?? "aucune"}.`);
  }
  if (changedSteps.length) parts.push(`${changedSteps.length} étape(s) modifiée(s).`);
  return { changedSteps, outcomeBefore: before.outcome, outcomeAfter: after.outcome, summary: parts.join(" ") };
}

/** Faits exposés aux défis : faits du scénario + synthèse du résultat. */
export function missionFacts(r: SimulationResult): Facts {
  return {
    ...r.facts,
    outcome: r.outcome,
    decisiveRuleId: r.decisiveRuleId ?? "none",
    objectiveMet: r.objective.met === true ? "yes" : r.objective.met === false ? "no" : "unknown",
  };
}

export function missionAchieved(r: SimulationResult, m: Mission): boolean {
  return evaluateCondition(m.success, missionFacts(r));
}
