import type {
  ArchitectureNode, Facts, NodeDetails, NodeKind, Necessity, Outcome, Rule, SimulationResult, SourceRef, StepResult, StoryItem,
} from "../../lib/types/index.ts";
import type { OutcomeSummarizer } from "../../lib/policy-engine/engine.ts";

export const V = "2026-11-11" as const;

export const rule = (x: Omit<Rule, "version" | "lastVerified">): Rule => ({ version: 1, lastVerified: V, ...x });

/** Nœud compact : seuls les champs utiles sont fournis, le reste est vide. */
export function node(
  id: string, label: string, product: string, kind: NodeKind, layer: number, row: number, necessity: Necessity,
  d: Partial<NodeDetails> & { why: string; responsibility: string },
): ArchitectureNode {
  return {
    id, label, product, kind, layer, row, necessity,
    details: { inputs: [], outputs: [], identities: [], rights: [], controls: [], limits: [], prerequisites: [], refs: [] as SourceRef[], ...d },
  };
}

export interface SummaryConfig {
  /** Le résultat obtenu serait-il une violation de l'objectif ? */
  violation: (f: Facts) => string | null;
  /** La demande était-elle légitime (un refus serait alors un échec métier) ? */
  legit: (f: Facts) => boolean;
  okText: (f: Facts) => string;
  story: (f: Facts, outcome: Outcome, steps: StepResult[]) => StoryItem[];
  risks: [(f: Facts) => boolean, string][];
  audit?: (f: Facts, outcome: Outcome) => string[];
}

export const firstBlock = (steps: StepResult[]) => steps.flatMap((s) => s.matched).find((m) => m.decision === "deny" || m.decision === "indeterminate");

export function summarizer(c: SummaryConfig): OutcomeSummarizer {
  return ({ facts, steps, outcome }) => {
    const v = c.violation(facts);
    let objective: SimulationResult["objective"];
    if (outcome === "indeterminate") objective = { met: null, explanation: "Impossible de conclure : un comportement décisif n'est pas documenté." };
    else if (outcome === "obtained" && v) objective = { met: false, explanation: `Objectif non atteint : ${v}` };
    else if (outcome === "obtained") objective = { met: true, explanation: `Objectif atteint : ${c.okText(facts)}` };
    else if (c.legit(facts)) objective = { met: false, explanation: "Sécurisé, mais une demande légitime est bloquée : objectif métier non atteint." };
    else objective = { met: true, explanation: "Objectif atteint : la demande non autorisée est bloquée." };
    return {
      obtained: outcome === "obtained" ? [String(facts.targetLabel ?? "Demande servie")] : [],
      refused: outcome === "refused" || outcome === "blocked-before-runtime" ? [String(facts.targetLabel ?? "Demande")] : [],
      auditEvents: c.audit ? c.audit(facts, outcome) : [],
      objective,
      residualRisks: c.risks.filter(([cond]) => cond(facts)).map(([, t]) => t),
      story: c.story(facts, outcome, steps),
    };
  };
}

/** Récit standard : question, puis réponse ou blocage. */
export function basicStory(f: Facts, outcome: Outcome, steps: StepResult[], agent: string, answer: string, leakTone: boolean): StoryItem[] {
  const s: StoryItem[] = [{ actor: "user", label: String(f.userName), text: String(f.questionText), tone: "neutral" }];
  const b = firstBlock(steps);
  if (outcome === "obtained") s.push({ actor: "agent", label: agent, text: answer, tone: leakTone ? "warn" : "allow" });
  else if (outcome === "indeterminate") s.push({ actor: "system", label: "À vérifier", text: b?.rationale ?? "", tone: "warn" });
  else s.push({ actor: "system", label: outcome === "blocked-before-runtime" ? "Non publiable" : "Bloqué", text: b?.rationale ?? "", tone: "deny" });
  return s;
}
