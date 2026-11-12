import type { Condition, Facts, ParamValues, ScenarioDef } from "../../../lib/types/index.ts";
import type { FactDeriver } from "../../../lib/policy-engine/engine.ts";
import { REF } from "../../sources.ts";
import { basicStory, node, rule, summarizer } from "../_kit.ts";

const knowledge: Condition = { eq: ["access", "knowledge"] };
const SCOPE: Record<string, "bu" | "org" | "none"> = { leo: "bu", clara: "org", sam: "none" };

export const salesScenario: ScenarioDef = {
  id: "sales-dataverse", version: "0.1.0", title: "Agent commercial Dataverse",
  customerRequest: "Je souhaite un agent commercial qui analyse les données clients dans Dataverse et les historiques de ventes pour proposer des recommandations.",
  businessContext: "Négociant fictif Ventolis : deux unités commerciales (Ouest, Est) et une colonne « Remise plancher » réservée à la direction.",
  objective: "Chaque commercial voit ses comptes ; la remise plancher et le pipeline ne quittent pas l'entreprise.",
  outcomeLabels: { obtained: "Recommandations produites", refused: "Requête refusée" },
  serviceAccountGroups: [],
  personas: [
    { id: "leo", name: "Léo Garnier", role: "Commercial unité Ouest", groups: [] },
    { id: "clara", name: "Clara Benoît", role: "Directrice commerciale", groups: [] },
    { id: "sam", name: "Sam Petit", role: "Stagiaire marketing", groups: [] },
  ],
  documents: [
    { id: "acc", title: "Comptes et opportunités", library: "Dataverse", label: "Interne", readGroups: [], labelExtractGroups: [], dlpTargetedLabel: false, sensitivity: "internal" },
    { id: "floor", title: "Colonne Remise plancher", library: "Dataverse (sécurité de colonne)", label: "Confidentiel", readGroups: [], labelExtractGroups: [], dlpTargetedLabel: false, sensitivity: "confidential" },
  ],
  requests: [],
  parameters: [
    { id: "user", label: "Utilisateur", group: "Acteur", default: "leo", options: [
      { value: "leo", label: "Léo — Commercial Ouest" }, { value: "clara", label: "Clara — Directrice commerciale" }, { value: "sam", label: "Sam — Stagiaire marketing" }] },
    { id: "question", label: "Question", group: "Demande", default: "own", options: [
      { value: "own", label: "Mes comptes à relancer" }, { value: "pipeline", label: "Tout le pipeline" }, { value: "floor", label: "Remise plancher d'un client" }] },
    { id: "access", label: "Accès aux données", group: "Architecture", default: "knowledge", options: [
      { value: "knowledge", label: "Connaissance Dataverse (contexte utilisateur)" }, { value: "flow-maker", label: "Flux d'agent avec connexion du maker" }] },
    { id: "makerCreds", label: "Identifiants du maker (environnement)", group: "Gouvernance", default: "allowed", options: [
      { value: "allowed", label: "Autorisés" }, { value: "disabled", label: "Interdits" }] },
    { id: "colSec", label: "Sécurité de colonne « Remise plancher »", group: "Dataverse", default: "on", options: [
      { value: "on", label: "Activée (profil Direction)" }, { value: "off", label: "Désactivée" }] },
    { id: "export", label: "Envoi des recommandations", group: "Architecture", default: "none", options: [
      { value: "none", label: "Dans la conversation" }, { value: "gmail", label: "Vers une adresse Gmail" }] },
    { id: "gmailPolicy", label: "Politique de données", group: "Gouvernance", default: "same-group", options: [
      { value: "same-group", label: "Aucune séparation" }, { value: "non-business", label: "Gmail en Non-business" }] },
  ],
  nodes: [
    node("user", "Commercial", "Utilisateur Dynamics 365 / Power Apps", "actor", 0, 1, "required", { why: "Son rôle et son unité commerciale bornent ce qu'il voit.", responsibility: "Demande des recommandations." }),
    node("agent", "Agent commercial", "Microsoft Copilot Studio", "agent", 1, 1, "required", { why: "Analyse comptes et historiques.", responsibility: "Interroge Dataverse et rédige les recommandations." }),
    node("ppac", "Politiques de données", "Power Platform admin center", "governance-admin", 1, 2, "recommended", { why: "Sépare les connecteurs Business et Non-business.", responsibility: "Empêche de combiner Dataverse et Gmail dans un même agent.", limits: ["Agit à la configuration et à la publication."], refs: [REF.cpsDataPolicies] }),
    node("dv", "Dataverse", "Microsoft Dataverse", "source", 2, 1, "required", { why: "Comptes, opportunités, historique.", responsibility: "Applique rôles de sécurité, unités commerciales et sécurité de colonne.", rights: ["Rôle de sécurité Dataverse (au minimum Basic User)"], refs: [REF.dataverseKnowledge] }),
    node("result", "Recommandations", "Réponse de l'agent", "output", 3, 1, "required", { why: "Ce que reçoit le commercial.", responsibility: "Liste de relances." }),
    node("gmail", "Gmail", "Connecteur Gmail (externe)", "external", 2, 0, "optional", { why: "Mauvaise configuration : sortie hors de l'entreprise.", responsibility: "Envoie un e-mail." }),
  ],
  edges: [
    { id: "e1", from: "user", to: "agent", kind: "data", label: "question" },
    { id: "e2", from: "ppac", to: "agent", kind: "policy", label: "groupes de connecteurs" },
    { id: "e3", from: "agent", to: "dv", kind: "api", label: "requête Dataverse" },
    { id: "e4", from: "dv", to: "result", kind: "data", label: "enregistrements accordés" },
    { id: "e5", from: "agent", to: "gmail", kind: "data", label: "envoi", visibleWhen: { eq: ["export", "gmail"] } },
  ],
  steps: [
    { id: "request", order: 1, title: "Question", description: "Données demandées.", nodeIds: ["user", "agent"], edgeIds: ["e1"] },
    { id: "governance", order: 2, title: "Politique de données", description: "Configuration publiable ?", nodeIds: ["ppac", "agent"], edgeIds: ["e2"] },
    { id: "identity", order: 3, title: "Identité", description: "Qui interroge Dataverse ?", nodeIds: ["agent"], edgeIds: [] },
    { id: "rows", order: 4, title: "Rôles et unités", description: "Quels enregistrements ?", nodeIds: ["agent", "dv"], edgeIds: ["e3"] },
    { id: "columns", order: 5, title: "Colonnes", description: "La remise plancher est-elle visible ?", nodeIds: ["dv"], edgeIds: [] },
    { id: "output", order: 6, title: "Sortie", description: "Où partent les recommandations ?", nodeIds: ["result", "gmail"], edgeIds: ["e4", "e5"] },
  ],
  rules: [
    rule({ id: "CRM-REQ", stepId: "request", priority: 1, product: "—", controlKind: "classification", fallback: true, description: "Demande.", when: { all: [] }, decision: "observed", risk: "none", confidence: "high", ref: REF.dataverseKnowledge, rationale: "{userName} demande : {targetLabel}." }),
    rule({ id: "CRM-DLP", stepId: "governance", priority: 1, product: "Power Platform (politique de données)", controlKind: "admin-governance", preRuntime: true, description: "Dataverse et Gmail dans des groupes différents.", when: { all: [{ eq: ["export", "gmail"] }, { eq: ["gmailPolicy", "non-business"] }] }, decision: "deny", risk: "none", confidence: "high", ref: REF.cpsDataPolicies, rationale: "Dataverse est Business, Gmail Non-business : des connecteurs de groupes différents ne peuvent pas échanger de données. L'agent n'est pas publiable." }),
    rule({ id: "CRM-GMAIL", stepId: "governance", priority: 2, product: "Power Platform (politique de données)", controlKind: "admin-governance", description: "Aucune séparation des connecteurs.", when: { eq: ["export", "gmail"] }, decision: "allow", risk: "high", confidence: "high", ref: REF.cpsDataPolicies, rationale: "Aucune politique ne sépare Dataverse et Gmail : l'agent peut envoyer des données CRM vers une messagerie personnelle." }),
    rule({ id: "CRM-GOV-OK", stepId: "governance", priority: 9, product: "Power Platform", controlKind: "admin-governance", fallback: true, description: "Publiable.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.cpsDataPolicies, rationale: "Aucune politique ne bloque la configuration." }),
    rule({ id: "CRM-ID-MAKER", stepId: "identity", priority: 1, product: "Copilot Studio (flux d'agent)", controlKind: "identity-resolution", description: "Connexion du maker.", when: { eq: ["principalKind", "maker"] }, decision: "observed", risk: "high", confidence: "high", ref: REF.cpsMakerCredentials, rationale: "Le flux utilise la connexion du maker (administrateur) : le rôle de {userName} n'est plus évalué." }),
    rule({ id: "CRM-ID-USER", stepId: "identity", priority: 9, product: "Copilot Studio", controlKind: "identity-resolution", fallback: true, description: "Contexte utilisateur.", when: { all: [] }, decision: "observed", risk: "none", confidence: "high", ref: REF.dataverseKnowledge, rationale: "Dataverse est interrogé dans le contexte de {userName}, selon ses rôles de sécurité." }),
    rule({ id: "CRM-NOROLE", stepId: "rows", priority: 1, product: "Microsoft Dataverse", controlKind: "source-authorization", stopsRuntime: true, description: "Aucun rôle de lecture.", when: { eq: ["rowScope", "none"] }, decision: "deny", risk: "none", confidence: "high", ref: REF.dataverseKnowledge, rationale: "{principalName} n'a aucun rôle de lecture sur les comptes : aucun enregistrement." }),
    rule({ id: "CRM-BU", stepId: "rows", priority: 2, product: "Microsoft Dataverse", controlKind: "source-authorization", description: "Filtrage par unité commerciale.", when: { all: [{ eq: ["rowScope", "bu"] }, { eq: ["question", "pipeline"] }] }, decision: "allow", risk: "none", confidence: "high", ref: REF.dataverseKnowledge, rationale: "Le rôle de {userName} porte sur son unité : seuls les comptes Ouest sont renvoyés." }),
    rule({ id: "CRM-ROWS-OK", stepId: "rows", priority: 9, product: "Microsoft Dataverse", controlKind: "source-authorization", fallback: true, description: "Enregistrements accordés.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.dataverseKnowledge, rationale: "Enregistrements accordés à {principalName} : {rowsLabel}." }),
    rule({ id: "CRM-COL-KNOW", stepId: "columns", priority: 1, product: "Copilot Studio (connaissance Dataverse)", controlKind: "source-authorization", description: "Sécurité de colonne via la connaissance.", when: { all: [knowledge, { eq: ["question", "floor"] }, { eq: ["colSec", "on"] }, { eq: ["hasProfile", false] }] }, decision: "indeterminate", risk: "medium", confidence: "low", ref: REF.dataverseKnowledge, rationale: "La documentation consultée confirme le respect des rôles de sécurité, pas explicitement de la sécurité de colonne via la connaissance. À tester avant de s'y fier." }),
    rule({ id: "CRM-COL-DENY", stepId: "columns", priority: 2, product: "Microsoft Dataverse", controlKind: "source-authorization", stopsRuntime: true, description: "Colonne sécurisée refusée.", when: { all: [{ not: knowledge }, { eq: ["question", "floor"] }, { eq: ["colSec", "on"] }, { eq: ["hasProfile", false] }] }, decision: "deny", risk: "none", confidence: "medium", ref: REF.dataverseKnowledge, rationale: "{principalName} n'a pas le profil de sécurité de colonne : la remise plancher n'est pas lue." }),
    rule({ id: "CRM-COL-OPEN", stepId: "columns", priority: 3, product: "Microsoft Dataverse", controlKind: "source-authorization", description: "Colonne non protégée.", when: { all: [{ eq: ["question", "floor"] }, { eq: ["exceedsLegit", true] }] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.dataverseKnowledge, rationale: "La remise plancher est lisible par {principalName} : un commercial connaît la marge de négociation de la direction." }),
    rule({ id: "CRM-COL-OK", stepId: "columns", priority: 4, product: "Microsoft Dataverse", controlKind: "source-authorization", description: "Profil autorisé.", when: { all: [{ eq: ["question", "floor"] }, { eq: ["exceedsLegit", false] }] }, decision: "allow", risk: "none", confidence: "medium", ref: REF.dataverseKnowledge, rationale: "{principalName} a le profil Direction : la remise plancher est lisible, comme prévu." }),
    rule({ id: "CRM-COL-NA", stepId: "columns", priority: 9, product: "—", controlKind: "source-authorization", fallback: true, description: "Colonnes standard.", when: { all: [] }, decision: "not-applicable", risk: "none", confidence: "high", ref: REF.dataverseKnowledge, rationale: "Aucune colonne sécurisée demandée." }),
    rule({ id: "CRM-OUT-GMAIL", stepId: "output", priority: 1, product: "Connecteur Gmail", controlKind: "data-loss-prevention", description: "Données envoyées vers Gmail.", when: { eq: ["export", "gmail"] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.cpsDataPolicies, rationale: "Les recommandations et les données clients partent vers une adresse Gmail." }),
    rule({ id: "CRM-OUT-LEAK", stepId: "output", priority: 2, product: "—", controlKind: "source-authorization", description: "Au-delà du besoin.", when: { eq: ["exceedsLegit", true] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.dataverseKnowledge, rationale: "{userName} reçoit {extra}." }),
    rule({ id: "CRM-OUT", stepId: "output", priority: 9, product: "—", controlKind: "classification", fallback: true, description: "Réponse dans la conversation.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.dataverseKnowledge, rationale: "Recommandations affichées à {userName} : {rowsLabel}." }),
  ],
  presets: [
    { id: "A", question: "Situation de départ : Léo demande ses relances", title: "A — Mes comptes", summary: "Léo demande ses relances : comptes Ouest.", params: { user: "leo", question: "own" } },
    { id: "B", question: "Et si Léo demandait tout le pipeline ?", title: "B — Tout le pipeline", summary: "Léo demande tout le pipeline : Dataverse filtre sur son unité.", params: { user: "leo", question: "pipeline" } },
    { id: "C", question: "Et si la remise plancher n'était pas protégée ?", title: "C — Remise plancher ouverte", summary: "Sans sécurité de colonne, Léo lit la remise plancher.", params: { user: "leo", question: "floor", colSec: "off" } },
    { id: "D", question: "Et si la colonne était protégée, mais lue via la connaissance ?", title: "D — Colonne via la connaissance", summary: "Sécurité de colonne active, accès par la connaissance : comportement à vérifier.", params: { user: "leo", question: "floor" } },
    { id: "E", question: "Et si le stagiaire passait par la connexion du maker ?", title: "E — Stagiaire via le maker", summary: "Sam n'a aucun rôle, mais le flux utilise la connexion du maker.", params: { user: "sam", question: "pipeline", access: "flow-maker" } },
    { id: "F", question: "Et si l'agent envoyait les résultats sur Gmail ?", title: "F — Export Gmail bloqué", summary: "Gmail en Non-business : l'agent n'est pas publiable.", params: { export: "gmail", gmailPolicy: "non-business" } },
  ],
  missions: [
    { id: "crm-m1", title: "Donner tout le pipeline à Sam sans lui attribuer de rôle", hint: "Qui parle vraiment à Dataverse ?", success: { all: [{ eq: ["user", "sam"] }, { eq: ["question", "pipeline"] }, { eq: ["outcome", "obtained"] }] }, lesson: "Une connexion partagée efface le modèle de rôles de Dataverse." },
    { id: "crm-m2", title: "Arrêter l'export Gmail avant même la publication", hint: "Les connecteurs vivent dans des groupes.", success: { eq: ["decisiveRuleId", "CRM-DLP"] }, lesson: "Séparer Business et Non-business empêche les mélanges de données dès la conception." },
  ],
};

export const deriveSales: FactDeriver = (s: ScenarioDef, p: ParamValues): Facts => {
  const u = s.personas.find((x) => x.id === p.user);
  if (!u) throw new Error("Persona inconnue");
  const maker = p.access === "flow-maker" && p.makerCreds === "allowed";
  const scope = maker ? "org" : SCOPE[u.id] ?? "none";
  const hasProfile = maker || u.id === "clara";
  const floorVisible = p.question === "floor" && scope !== "none" && (p.colSec === "off" || hasProfile);
  const legitScope = SCOPE[u.id] ?? "none";
  const rowsBeyond = scope === "org" && legitScope !== "org" && p.question !== "floor";
  const floorBeyond = floorVisible && u.id !== "clara";
  const extra = [rowsBeyond ? "les comptes de toutes les unités" : "", floorBeyond ? "la remise plancher" : ""].filter(Boolean).join(" et ");
  return {
    ...p, userName: u.name, principalKind: maker ? "maker" : "user", principalName: maker ? "la connexion du maker" : u.name,
    questionText: { own: "Quels comptes dois-je relancer cette semaine ?", pipeline: "Montre-moi tout le pipeline de l'entreprise.", floor: "Quelle est la remise plancher pour Bricomax ?" }[p.question ?? "own"] ?? "",
    targetLabel: { own: "Comptes de l'utilisateur", pipeline: "Pipeline complet", floor: "Remise plancher Bricomax" }[p.question ?? "own"] ?? "",
    rowScope: scope, hasProfile, rowsLabel: scope === "org" ? "toutes les unités" : scope === "bu" ? "unité Ouest" : "aucun",
    exceedsLegit: extra.length > 0, extra: extra || "rien de plus",
    legitRequest: legitScope !== "none" && (p.question !== "floor" || u.id === "clara"),
  };
};

export const summarizeSales = summarizer({
  violation: (f) => (f.export === "gmail" ? "les données clients partent vers Gmail." : f.exceedsLegit ? `${f.userName} reçoit ${f.extra}.` : null),
  legit: (f) => f.legitRequest === true && f.export !== "gmail",
  okText: (f) => `recommandations limitées à ${f.rowsLabel}.`,
  story: (f, o, st) => basicStory(f, o, st, "Agent commercial", f.question === "floor" ? "Remise plancher Bricomax : 18 % [fictif]." : `Relances proposées — périmètre : ${f.rowsLabel} [données fictives].`, f.exceedsLegit === true || f.export === "gmail"),
  risks: [
    [(f) => f.makerCreds === "allowed", "Les flux peuvent encore utiliser la connexion du maker."],
    [(f) => f.colSec === "off", "La remise plancher n'est pas protégée par la sécurité de colonne."],
    [(f) => f.gmailPolicy === "same-group", "Aucune politique ne sépare les connecteurs Business et Non-business."],
  ],
});
