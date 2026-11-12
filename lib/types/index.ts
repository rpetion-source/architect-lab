// Contrats du domaine — indépendants de React et de Next.js.

export type ISODate = `${number}-${number}-${number}`;

/** Responsabilités non interchangeables (§13 du cahier des charges). */
export type ControlKind =
  | "authentication"
  | "source-authorization"
  | "classification"
  | "data-loss-prevention"
  | "monitoring"
  | "audit"
  | "threat-detection"
  | "admin-governance"
  | "identity-resolution";

/** États visuels : vert, rouge, orange, gris, bleu, indéterminé. */
export type Decision =
  | "allow"
  | "deny"
  | "conditional"
  | "not-applicable"
  | "observed"
  | "indeterminate";

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export type FlowKind = "data" | "api" | "auth" | "policy" | "telemetry" | "governance";

/** "Unstated" : la page consultée ne précise ni GA ni Preview. */
export type FeatureStatus = "GA" | "Preview" | "Unstated" | "Unverified";
export type Confidence = "high" | "medium" | "low";

export interface SourceRef {
  title: string;
  url: string;
  verifiedOn: ISODate;
  status: FeatureStatus;
}

export type Necessity = "required" | "recommended" | "optional";

export type NodeKind =
  | "actor"
  | "identity"
  | "agent"
  | "governance-admin"
  | "connector"
  | "source"
  | "data-protection"
  | "audit"
  | "output"
  | "external";

export interface NodeDetails {
  why: string;
  responsibility: string;
  inputs: string[];
  outputs: string[];
  identities: string[];
  rights: string[];
  controls: string[];
  limits: string[];
  prerequisites: string[];
  refs: SourceRef[];
}

export interface ArchitectureNode {
  id: string;
  label: string;
  product: string;
  kind: NodeKind;
  necessity: Necessity;
  /** Couche logique utilisée par la mise en page (0 = gauche). */
  layer: number;
  /** Rangée dans la couche ; choisie pour qu'aucun flux ne traverse une brique. */
  row?: number;
  details: NodeDetails;
  /** Le nœud n'apparaît que si la condition est vraie (ex. outil connecteur). */
  visibleWhen?: Condition;
}

export interface ArchitectureEdge {
  id: string;
  from: string;
  to: string;
  kind: FlowKind;
  label: string;
  visibleWhen?: Condition;
}

// ---------- Paramètres What-if ----------

export interface ParamOption {
  value: string;
  label: string;
  hint?: string;
}

export interface ParameterDef {
  id: string;
  label: string;
  /** Regroupement affiché dans le panneau des paramètres. */
  group: string;
  options: ParamOption[];
  default: string;
}

export type ParamValues = Record<string, string>;

// ---------- Données synthétiques ----------

export interface Persona {
  id: string;
  name: string;
  role: string;
  groups: string[];
}

export interface DocumentDef {
  id: string;
  title: string;
  library: string;
  label: string;
  /** Groupes ayant Read sur la bibliothèque (ACL à la source). */
  readGroups: string[];
  /** Groupes ayant VIEW + EXTRACT dans l'étiquette chiffrée. */
  labelExtractGroups: string[];
  /** L'étiquette est-elle ciblée par la politique DLP Copilot de démonstration ? */
  dlpTargetedLabel: boolean;
  sensitivity: "public" | "internal" | "confidential" | "highly-confidential";
}

export interface RequestDef {
  id: string;
  text: string;
  targetDocumentId: string;
  sensitivityNote: string;
}

// ---------- Règles ----------

export type FactValue = string | boolean;
export type Facts = Record<string, FactValue>;

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { eq: [string, FactValue] }
  | { in: [string, FactValue[]] };

export interface Rule {
  id: string;
  version: number;
  description: string;
  product: string;
  controlKind: ControlKind;
  stepId: string;
  /** Plus petit = évalué en premier dans l'étape. */
  priority: number;
  when: Condition;
  decision: Decision;
  risk: RiskLevel;
  /** Texte avec gabarits {fact}. */
  rationale: string;
  ref: SourceRef;
  confidence: Confidence;
  lastVerified: ISODate;
  /** Si vrai, une décision deny arrête le parcours d'exécution. */
  stopsRuntime?: boolean;
  /** Règle par défaut : retenue seulement si aucune autre règle de l’étape ne correspond. */
  fallback?: boolean;
  /** Si vrai, le blocage a lieu avant la mise en production (publication). */
  preRuntime?: boolean;
}

export interface StepDef {
  id: string;
  order: number;
  title: string;
  description: string;
  nodeIds: string[];
  edgeIds: string[];
  /** Étape d'observation qui reste évaluée même après un refus à l'exécution. */
  observesAfterDeny?: boolean;
}

export interface ScenarioDef {
  id: string;
  version: string;
  title: string;
  customerRequest: string;
  businessContext: string;
  objective: string;
  personas: Persona[];
  documents: DocumentDef[];
  requests: RequestDef[];
  parameters: ParameterDef[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  steps: StepDef[];
  rules: Rule[];
  presets: WhatIfPreset[];
  missions: Mission[];
  serviceAccountGroups: string[];
  /** Libellés de résultat propres au scénario (ex. « Action exécutée »). */
  outcomeLabels?: Partial<Record<Outcome, string>>;
}

/** Défi ludique : une condition à atteindre sur les faits et le résultat. */
export interface Mission {
  id: string;
  title: string;
  hint: string;
  /** Faits disponibles : faits du scénario + outcome, decisiveRuleId ("none" si aucune), objectiveMet ("yes" | "no" | "unknown"). */
  success: Condition;
  lesson: string;
}

export interface WhatIfPreset {
  id: string;
  title: string;
  /** Question en langage courant affichée à l'utilisateur (« Et si… ? »). */
  question?: string;
  summary: string;
  params: Partial<ParamValues>;
}

// ---------- Résultats ----------

export interface MatchedRule {
  ruleId: string;
  decision: Decision;
  risk: RiskLevel;
  rationale: string;
  controlKind: ControlKind;
  product: string;
  confidence: Confidence;
  ref: SourceRef;
}

export interface StepResult {
  stepId: string;
  title: string;
  decision: Decision;
  risk: RiskLevel;
  matched: MatchedRule[];
  /** Raison de l'état « non applicable » quand l'étape est sautée. */
  skippedBecause?: string;
  nodeIds: string[];
  edgeIds: string[];
}

export interface StoryItem {
  actor: "user" | "agent" | "tool" | "human" | "system" | "attacker";
  label: string;
  text: string;
  tone: "neutral" | "allow" | "deny" | "warn" | "attack" | "info";
}

export interface DataTableView {
  title: string;
  columns: { name: string; visible: boolean; requested: boolean; sensitive: boolean }[];
  rows: { id: string; cells: string[]; visible: boolean }[];
  note: string;
}

export type Outcome = "obtained" | "refused" | "blocked-before-runtime" | "indeterminate";

export interface SimulationResult {
  scenarioId: string;
  params: ParamValues;
  facts: Facts;
  steps: StepResult[];
  outcome: Outcome;
  decisiveRuleId: string | null;
  decisiveControl: ControlKind | null;
  obtained: string[];
  refused: string[];
  auditEvents: string[];
  objective: { met: boolean | null; explanation: string };
  residualRisks: string[];
  /** Ce que vivent l'utilisateur et l'agent, pour la narration visuelle. */
  story: StoryItem[];
  /** Vue tabulaire des données réellement visibles (scénarios de données). */
  table?: DataTableView;
}

export interface ResultDiff {
  changedSteps: { stepId: string; title: string; before: Decision; after: Decision }[];
  outcomeBefore: Outcome;
  outcomeAfter: Outcome;
  summary: string;
}
