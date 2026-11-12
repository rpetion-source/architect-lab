import type { Condition, Facts, ParamValues, ScenarioDef } from "../../../lib/types/index.ts";
import type { FactDeriver } from "../../../lib/policy-engine/engine.ts";
import { REF } from "../../sources.ts";
import { basicStory, node, rule, summarizer } from "../_kit.ts";

const ALL = ["FRSI", "DEMF", "USMF"];
const FO_RIGHTS: Record<string, string[]> = { paul: ["FRSI"], amelie: ALL, tom: [] };
const LEGIT: Record<string, string[]> = { paul: ["FRSI"], amelie: ALL, tom: ALL };
const fabric: Condition = { eq: ["path", "fabric"] };
const live: Condition = { not: fabric };

export const financeScenario: ScenarioDef = {
  id: "finance-d365", version: "0.1.0", title: "Agent financier D365FO",
  customerRequest: "Je souhaite un agent IA capable de consulter les données financières de Dynamics 365 Finance & Operations, produire des analyses et respecter les autorisations des utilisateurs.",
  businessContext: "Groupe fictif Northwind Industrie : trois entités juridiques (FRSI, DEMF, USMF) et des tables de paie sensibles.",
  objective: "Chaque contrôleur ne voit que ses entités ; la paie détaillée ne sort jamais.",
  outcomeLabels: { obtained: "Données renvoyées", refused: "Requête refusée" },
  serviceAccountGroups: [],
  personas: [
    { id: "paul", name: "Paul Mercier", role: "Contrôleur filiale France", groups: [] },
    { id: "amelie", name: "Amélie Roux", role: "Directrice financière groupe", groups: [] },
    { id: "tom", name: "Tom Nguyen", role: "Analyste data (Contributor Fabric)", groups: [] },
  ],
  documents: [
    { id: "gl", title: "Balances du grand livre", library: "D365 F&O", label: "Confidentiel", readGroups: [], labelExtractGroups: [], dlpTargetedLabel: false, sensitivity: "confidential" },
    { id: "pay", title: "Lignes de paie détaillées", library: "D365 F&O", label: "Hautement confidentiel", readGroups: [], labelExtractGroups: [], dlpTargetedLabel: false, sensitivity: "highly-confidential" },
  ],
  requests: [],
  parameters: [
    { id: "user", label: "Utilisateur", group: "Acteur", default: "paul", options: [
      { value: "paul", label: "Paul — Contrôleur FR" }, { value: "amelie", label: "Amélie — DAF groupe" }, { value: "tom", label: "Tom — Analyste data" }] },
    { id: "question", label: "Question", group: "Demande", default: "all", options: [
      { value: "own", label: "Résultat de ma filiale" }, { value: "all", label: "Comparer toutes les entités" }, { value: "payroll", label: "Détail de la paie FR" }] },
    { id: "path", label: "Stratégie d'intégration", group: "Architecture", default: "live", options: [
      { value: "live", label: "Lecture directe F&O (identité utilisateur)" }, { value: "live-maker", label: "Lecture directe F&O (identifiants du maker)" },
      { value: "fabric", label: "Copie via Link to Fabric" }] },
    { id: "makerCreds", label: "Identifiants du maker (environnement)", group: "Gouvernance", default: "allowed", options: [
      { value: "allowed", label: "Autorisés" }, { value: "disabled", label: "Interdits" }] },
    { id: "fabricRls", label: "Rôle OneLake des contrôleurs", group: "Fabric", default: "by-entity", options: [
      { value: "by-entity", label: "RLS par entité" }, { value: "none", label: "Table entière, sans RLS" }] },
    { id: "linkPayroll", label: "Tables de paie liées à Fabric", group: "Fabric", default: "no", options: [
      { value: "no", label: "Non" }, { value: "yes", label: "Oui" }] },
  ],
  nodes: [
    node("user", "Contrôleur", "Utilisateur finance", "actor", 0, 1, "required", { why: "Ses droits F&O devraient borner l'agent.", responsibility: "Pose une question financière." }),
    node("agent", "Agent finance", "Microsoft Copilot Studio", "agent", 1, 1, "required", { why: "Traduit la question et assemble l'analyse.", responsibility: "Appelle F&O en direct ou interroge Fabric.", limits: ["L'agent n'a pas de notion d'entité juridique : il hérite des droits de l'identité utilisée."], refs: [REF.cpsConnectors] }),
    node("ppac", "Paramètre maker", "Power Platform admin center", "governance-admin", 1, 2, "recommended", { why: "Peut interdire les identifiants partagés.", responsibility: "« Control maker credential options ».", refs: [REF.cpsMakerCredentials] }),
    node("fo", "D365 F&O", "Dynamics 365 Finance & Operations", "source", 2, 0, "required", { why: "Source de vérité avec ses rôles et entités juridiques.", responsibility: "Applique ses rôles à l'identité appelante.", rights: ["Accès aux entités juridiques", "Rôle Paie pour les lignes de paie"], limits: ["Ses rôles ne voyagent pas avec les données copiées ailleurs."] }),
    node("link", "Link to Fabric", "Dataverse / Synapse Link", "connector", 2, 2, "optional", { why: "Copie les tables F&O dans OneLake pour l'analyse.", responsibility: "Synchronise les tables choisies.", limits: ["Les tables F&O ne sont pas sélectionnées automatiquement.", "Activation : rôle Administrateur système Dataverse."], refs: [REF.linkToFabric, REF.fabricLinkTroubleshoot] }),
    node("onelake", "OneLake", "Microsoft Fabric — OneLake security", "data-protection", 3, 2, "optional", { why: "Après la copie, ce sont les rôles Fabric qui décident.", responsibility: "Rôles d'espace et rôles OneLake (RLS par entité).", limits: ["Contributor et plus ignorent RLS/CLS."], refs: [REF.fabricRlsCls, REF.fabricSecurityOverview] }),
    node("result", "Analyse", "Réponse de l'agent", "output", 3, 1, "required", { why: "Ce que voit le contrôleur.", responsibility: "Tableau par entité." }),
  ],
  edges: [
    { id: "e1", from: "user", to: "agent", kind: "data", label: "question" },
    { id: "e2", from: "ppac", to: "agent", kind: "policy", label: "identifiants autorisés" },
    { id: "e3", from: "agent", to: "fo", kind: "api", label: "lecture directe", visibleWhen: live },
    { id: "e4", from: "fo", to: "link", kind: "data", label: "copie des tables", visibleWhen: fabric },
    { id: "e5", from: "link", to: "onelake", kind: "data", label: "tables Delta", visibleWhen: fabric },
    { id: "e6", from: "agent", to: "link", kind: "api", label: "requête Fabric", visibleWhen: fabric },
    { id: "e7", from: "agent", to: "result", kind: "data", label: "analyse" },
  ],
  steps: [
    { id: "request", order: 1, title: "Question", description: "Entités et tables demandées.", nodeIds: ["user", "agent"], edgeIds: ["e1"] },
    { id: "identity", order: 2, title: "Identité", description: "Qui interroge les données ?", nodeIds: ["agent", "ppac"], edgeIds: ["e2"] },
    { id: "integration", order: 3, title: "Intégration", description: "Données lues à la source ou copiées ?", nodeIds: ["fo", "link", "onelake"], edgeIds: ["e4", "e5"] },
    { id: "authz", order: 4, title: "Autorisation", description: "Quelle couche applique quels droits ?", nodeIds: ["agent", "fo", "onelake"], edgeIds: ["e3", "e6"] },
    { id: "result", order: 5, title: "Résultat", description: "Ce qui sort réellement.", nodeIds: ["agent", "result"], edgeIds: ["e7"] },
  ],
  rules: [
    rule({ id: "FIN-REQ", stepId: "request", priority: 1, product: "—", controlKind: "classification", fallback: true, description: "Périmètre demandé.", when: { all: [] }, decision: "observed", risk: "none", confidence: "high", ref: REF.linkToFabric, rationale: "{userName} demande : {targetLabel}." }),
    rule({ id: "FIN-ID-MAKER", stepId: "identity", priority: 1, product: "Copilot Studio (connecteur)", controlKind: "identity-resolution", description: "Identifiants du maker.", when: { eq: ["principalKind", "maker"] }, decision: "observed", risk: "high", confidence: "high", ref: REF.cpsMakerCredentials, rationale: "Le connecteur F&O utilise le compte du maker (svc-fo-admin) : les rôles de {userName} ne comptent plus." }),
    rule({ id: "FIN-ID-SWITCH", stepId: "identity", priority: 2, product: "Power Platform (paramètre d'environnement)", controlKind: "admin-governance", description: "Identifiants du maker interdits.", when: { all: [{ eq: ["path", "live-maker"] }, { eq: ["makerCreds", "disabled"] }] }, decision: "observed", risk: "none", confidence: "high", ref: REF.cpsMakerCredentials, rationale: "Les identifiants du maker sont interdits : l'outil bascule sur l'identité de {userName}." }),
    rule({ id: "FIN-ID-USER", stepId: "identity", priority: 9, product: "Microsoft Entra ID", controlKind: "identity-resolution", fallback: true, description: "Identité de l'utilisateur.", when: { all: [] }, decision: "observed", risk: "none", confidence: "high", ref: REF.cpsConnectors, rationale: "Les données sont interrogées avec l'identité de {userName}." }),
    rule({ id: "FIN-LINK-NOPAY", stepId: "integration", priority: 1, product: "Link to Fabric", controlKind: "source-authorization", stopsRuntime: true, description: "Table de paie non liée.", when: { all: [fabric, { eq: ["question", "payroll"] }, { eq: ["linkPayroll", "no"] }] }, decision: "deny", risk: "none", confidence: "high", ref: REF.fabricLinkTroubleshoot, rationale: "Les tables F&O ne sont liées que si on les choisit : la paie n'a pas été ajoutée, elle n'existe pas dans OneLake." }),
    rule({ id: "FIN-LINK", stepId: "integration", priority: 2, product: "Link to Fabric", controlKind: "admin-governance", description: "Rôles F&O non recopiés.", when: fabric, decision: "observed", risk: "medium", confidence: "medium", ref: REF.linkToFabric, rationale: "Après la liaison, l'accès se donne par l'espace de travail Fabric. La documentation ne décrit aucune propagation des rôles F&O : ils sont modélisés comme non recopiés." }),
    rule({ id: "FIN-LIVE", stepId: "integration", priority: 9, product: "D365 F&O", controlKind: "source-authorization", fallback: true, description: "Lecture à la source.", when: { all: [] }, decision: "observed", risk: "none", confidence: "medium", ref: REF.cpsConnectors, rationale: "Lecture directe dans F&O : ce sont ses rôles et ses entités juridiques qui s'appliquent à l'identité appelante." }),
    rule({ id: "FIN-FO-DENY", stepId: "authz", priority: 1, product: "D365 F&O", controlKind: "source-authorization", stopsRuntime: true, description: "Aucun droit F&O.", when: { all: [live, { eq: ["returnedEmpty", true] }] }, decision: "deny", risk: "none", confidence: "medium", ref: REF.cpsConnectors, rationale: "{principalName} n'a accès à aucune des données demandées dans F&O : la requête est refusée." }),
    rule({ id: "FIN-FAB-DENY", stepId: "authz", priority: 2, product: "OneLake security", controlKind: "source-authorization", stopsRuntime: true, description: "Table non accordée dans Fabric.", when: { all: [fabric, { eq: ["returnedEmpty", true] }] }, decision: "deny", risk: "none", confidence: "high", ref: REF.fabricRlsCls, rationale: "Le rôle OneLake de {userName} n'accorde pas cette table : aucune donnée." }),
    rule({ id: "FIN-FAB-BYPASS", stepId: "authz", priority: 3, product: "Espace de travail Fabric", controlKind: "admin-governance", description: "Contributor : tout lisible.", when: { all: [fabric, { eq: ["bypass", true] }, { eq: ["exceedsLegit", true] }] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.fabricRlsCls, rationale: "{userName} est Contributor de l'espace : les rôles OneLake ne s'appliquent pas, toutes les tables liées sont lisibles." }),
    rule({ id: "FIN-FAB-NORLS", stepId: "authz", priority: 4, product: "OneLake security", controlKind: "source-authorization", description: "Rôle sans RLS par entité.", when: { all: [fabric, { eq: ["bypass", false] }, { eq: ["exceedsLegit", true] }] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.fabricRlsCls, rationale: "Le rôle OneLake accorde la table entière : {userName} voit {returnedEntities}, alors que F&O ne lui donnait que {foEntities}." }),
    rule({ id: "FIN-AUTHZ-OK", stepId: "authz", priority: 9, product: "Couche d'autorisation", controlKind: "source-authorization", fallback: true, description: "Droits appliqués.", when: { all: [] }, decision: "allow", risk: "none", confidence: "medium", ref: REF.fabricRlsCls, rationale: "Entités accordées : {returnedEntities}." }),
    rule({ id: "FIN-FILTER", stepId: "result", priority: 1, product: "—", controlKind: "source-authorization", description: "Vue filtrée.", when: { all: [{ eq: ["partial", true] }, { eq: ["exceedsLegit", false] }] }, decision: "allow", risk: "none", confidence: "medium", ref: REF.fabricRlsCls, rationale: "Vue filtrée : {returnedEntities} seulement, sur {requestedEntities} demandées." }),
    rule({ id: "FIN-LEAK", stepId: "result", priority: 2, product: "—", controlKind: "source-authorization", description: "Au-delà du besoin.", when: { eq: ["exceedsLegit", true] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.fabricRlsCls, rationale: "{userName} reçoit {extra}." }),
    rule({ id: "FIN-RES", stepId: "result", priority: 9, product: "—", controlKind: "source-authorization", fallback: true, description: "Résultat conforme.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.fabricRlsCls, rationale: "Résultat conforme au périmètre de {userName}." }),
  ],
  presets: [
    { id: "A", question: "Situation de départ : Paul compare les trois entités", title: "A — Lecture directe", summary: "Paul compare les entités en lecture directe : F&O ne lui renvoie que FRSI.", params: { user: "paul", question: "all", path: "live" } },
    { id: "B", question: "Et si le connecteur utilisait le compte du maker ?", title: "B — Identifiants du maker", summary: "Même question avec le compte du maker : les trois entités sortent.", params: { user: "paul", question: "all", path: "live-maker" } },
    { id: "C", question: "Et si les données passaient par Fabric, avec RLS ?", title: "C — Fabric avec RLS", summary: "Copie dans Fabric, rôle OneLake avec RLS par entité : vue filtrée.", params: { user: "paul", question: "all", path: "fabric" } },
    { id: "D", question: "Et si le rôle Fabric n'avait pas de RLS ?", title: "D — Fabric sans RLS", summary: "Le rôle OneLake accorde la table entière : Paul voit l'Allemagne et les États-Unis.", params: { user: "paul", question: "all", path: "fabric", fabricRls: "none" } },
    { id: "E", question: "Et si les tables de paie étaient copiées dans Fabric ?", title: "E — Paie liée par erreur", summary: "Les tables de paie ont été liées ; Tom, Contributor, les lit.", params: { user: "tom", question: "payroll", path: "fabric", linkPayroll: "yes" } },
  ],
  missions: [
    { id: "fin-m1", title: "Faire voir l'Allemagne à Paul sans lui donner de rôle F&O", hint: "Les rôles F&O ne voyagent pas avec les données copiées.", success: { all: [{ eq: ["user", "paul"] }, { eq: ["path", "fabric"] }, { eq: ["outcome", "obtained"] }, { eq: ["exceedsLegit", true] }] }, lesson: "Copier les données, c'est recréer la sécurité ailleurs : chaque couche a ses propres permissions." },
    { id: "fin-m2", title: "Rendre la paie inaccessible à Tom, même Contributor", hint: "Ce qui n'est pas copié ne peut pas fuiter.", success: { all: [{ eq: ["user", "tom"] }, { eq: ["question", "payroll"] }, { eq: ["path", "fabric"] }, { eq: ["outcome", "refused"] }] }, lesson: "La minimisation des données (ne lier que les tables utiles) est un contrôle aussi fort qu'un rôle." },
  ],
};

export const deriveFinance: FactDeriver = (s: ScenarioDef, p: ParamValues): Facts => {
  const u = s.personas.find((x) => x.id === p.user);
  if (!u) throw new Error("Persona inconnue");
  const isFabric = p.path === "fabric";
  const maker = p.path === "live-maker" && p.makerCreds === "allowed";
  const payroll = p.question === "payroll";
  const requested = p.question === "all" ? ALL : ["FRSI"];
  const bypass = isFabric && u.id === "tom";
  let granted: string[];
  let payrollGranted: boolean;
  if (!isFabric) { granted = maker ? ALL : FO_RIGHTS[u.id] ?? []; payrollGranted = maker; }
  else if (bypass) { granted = ALL; payrollGranted = p.linkPayroll === "yes"; }
  else { granted = p.fabricRls === "none" ? ALL : FO_RIGHTS[u.id] ?? []; payrollGranted = false; }
  const returned = payroll ? (payrollGranted ? ["FRSI"] : []) : requested.filter((e) => granted.includes(e));
  const legit = LEGIT[u.id] ?? [];
  const extraEntities = returned.filter((e) => !legit.includes(e));
  const extra = [payroll && returned.length ? "les lignes de paie détaillées" : "", extraEntities.length ? `les entités ${extraEntities.join(", ")}` : ""].filter(Boolean).join(" et ");
  return {
    ...p, userName: u.name, principalKind: maker ? "maker" : "user", principalName: maker ? "le compte svc-fo-admin" : u.name,
    questionText: { own: "Quel est le résultat de ma filiale ce trimestre ?", all: "Compare le résultat des trois entités.", payroll: "Montre-moi le détail de la paie France." }[p.question ?? "own"] ?? "",
    targetLabel: payroll ? "Lignes de paie FRSI" : `Grand livre ${requested.join(", ")}`,
    bypass, returnedEmpty: returned.length === 0, returnedEntities: returned.join(", ") || "aucune", requestedEntities: requested.join(", "),
    foEntities: (FO_RIGHTS[u.id] ?? []).join(", ") || "aucune", partial: !payroll && returned.length > 0 && returned.length < requested.length,
    exceedsLegit: extra.length > 0, extra: extra || "rien de plus",
    legitRequest: !payroll && requested.some((e) => legit.includes(e)),
  };
};

export const summarizeFinance = summarizer({
  violation: (f) => (f.exceedsLegit ? `${f.userName} reçoit ${f.extra}.` : null),
  legit: (f) => f.legitRequest === true,
  okText: (f) => `${f.userName} obtient ${f.returnedEntities}, conforme à son périmètre.`,
  story: (f, o, st) => basicStory(f, o, st, "Agent finance", `Résultat par entité : ${f.returnedEntities}${f.question === "payroll" ? " — lignes de paie" : ""} [chiffres fictifs].`, f.exceedsLegit === true),
  risks: [
    [(f) => f.makerCreds === "allowed", "Les makers peuvent encore utiliser un compte F&O partagé."],
    [(f) => f.path === "fabric" && f.fabricRls === "none", "Rôle OneLake sans RLS par entité : les contrôleurs voient tout le groupe."],
    [(f) => f.linkPayroll === "yes", "Les tables de paie sont copiées dans Fabric."],
    [(f) => f.path === "fabric", "Deux modèles de sécurité à maintenir en cohérence : F&O et Fabric."],
  ],
});
