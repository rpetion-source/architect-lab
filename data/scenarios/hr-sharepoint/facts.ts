import type { Facts, ParamValues, ScenarioDef, StoryItem } from "../../../lib/types/index.ts";
import type { FactDeriver, OutcomeSummarizer } from "../../../lib/policy-engine/engine.ts";

const intersects = (a: string[], b: string[]) => a.some((x) => b.includes(x));
const OVERSHARED_LIBRARY = "Rémunération";
const EVERYONE = "employes";

function find<T extends { id: string }>(items: T[], id: string, what: string): T {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`${what} introuvable : ${id}`);
  return item;
}

/** Faits dérivés de façon déterministe des paramètres et des données synthétiques. */
export const deriveHrFacts: FactDeriver = (scenario: ScenarioDef, p: ParamValues): Facts => {
  const user = find(scenario.personas, p.user ?? "", "Persona");
  const request = find(scenario.requests, p.request ?? "", "Demande");
  const doc = find(scenario.documents, request.targetDocumentId, "Document");

  const isConnector = p.path !== "knowledge";
  const principalKind = p.path === "connector-maker" && p.makerCreds === "allowed" ? "maker" : "user";
  const principalGroups = principalKind === "maker" ? scenario.serviceAccountGroups : user.groups;
  const principalName = principalKind === "maker" ? "svc-agent-rh (compte du maker)" : user.name;

  const overshared = p.overshare === "everyone" && doc.library === OVERSHARED_LIBRARY;
  const effectiveReadGroups = overshared ? [...doc.readGroups, EVERYONE] : doc.readGroups;
  const hasReadByAcl = intersects(principalGroups, doc.readGroups);
  const principalHasRead = intersects(principalGroups, effectiveReadGroups);
  const docIsSensitive = doc.sensitivity === "confidential" || doc.sensitivity === "highly-confidential";

  let dlpScopeReason = "politique désactivée";
  let dlpInScope = false;
  if (p.dlp === "on") {
    if (isConnector) dlpScopeReason = "le contenu passe par un outil connecteur, pas par la source de connaissance SharePoint";
    else if (p.channel !== "teams") dlpScopeReason = "le canal site web n'est pas couvert (Teams, SharePoint et Microsoft 365 Copilot seulement)";
    else { dlpInScope = true; dlpScopeReason = "dans le périmètre"; }
  }

  // Droit légitime de l'utilisateur, tel que prévu par la conception (sans surpartage).
  const userLegit = intersects(user.groups, doc.readGroups);

  return {
    ...p,
    userName: user.name,
    userRole: user.role,
    authLabel: p.agentAuth === "manual" ? "authentification manuelle" : "Authenticate with Microsoft",
    principalKind,
    principalName,
    targetTitle: doc.title,
    targetLabel: doc.label,
    targetLibrary: doc.library,
    docIsSensitive,
    principalHasRead,
    readViaOvershareOnly: principalHasRead && !hasReadByAcl,
    labelEncrypted: p.labelMode === "encrypted" && docIsSensitive,
    principalHasExtract: intersects(principalGroups, doc.labelExtractGroups),
    dlpTargetsDoc: doc.dlpTargetedLabel,
    dlpInScope,
    dlpScopeReason,
    userLegit,
  };
};

export const summarizeHr: OutcomeSummarizer = ({ scenario, facts, steps, outcome }) => {
  const title = String(facts.targetTitle);
  const obtained = outcome === "obtained" ? [title] : [];
  const refused = outcome === "refused" || outcome === "blocked-before-runtime" ? [title] : [];

  const auditStep = steps.find((s) => s.stepId === "audit");
  const auditEvents: string[] = [];
  if (auditStep && auditStep.decision !== "not-applicable") {
    auditEvents.push(outcome === "obtained"
      ? `Interaction Copilot Studio : prompt, réponse, fichier « ${title} » et étiquette « ${facts.targetLabel} »`
      : "Interaction Copilot Studio : prompt et réponse, sans fichier référencé");
    if (facts.channel === "website") auditEvents.push("Conditionné à la facturation Purview à l'usage (canal non Microsoft)");
  }

  const exfil = outcome === "obtained" && facts.httpNode === "external";
  let objective: { met: boolean | null; explanation: string };
  if (outcome === "indeterminate") {
    objective = { met: null, explanation: "Impossible de conclure : un comportement décisif n'est pas documenté." };
  } else if (exfil) {
    objective = { met: false, explanation: "Objectif non atteint : le contenu quitte le tenant vers un service externe." };
  } else if (outcome === "obtained" && !facts.userLegit) {
    objective = { met: false, explanation: `Objectif non atteint : ${facts.userName} obtient un contenu réservé aux RH.` };
  } else if (outcome === "obtained") {
    objective = { met: true, explanation: `Objectif atteint : ${facts.userName} obtient une réponse à laquelle il a droit.` };
  } else if (facts.userLegit) {
    objective = { met: false, explanation: `Sécurisé mais objectif métier non atteint : ${facts.userName} a légitimement accès et n'obtient pas de réponse.` };
  } else {
    objective = { met: true, explanation: `Objectif atteint : ${facts.userName} n'obtient pas un contenu auquel il n'a pas droit.` };
  }

  const residualRisks: string[] = [];
  if (facts.makerCreds === "allowed") residualRisks.push("Les makers peuvent encore choisir des identifiants partagés pour leurs outils.");
  if (facts.overshare === "everyone") residualRisks.push("La bibliothèque Rémunération est surpartagée : tout outil ou agent délégué l'expose.");
  if (facts.labelMode === "label-only" && facts.dlp === "off") residualRisks.push("Étiquettes confidentielles ni chiffrées ni ciblées par DLP : seule l'ACL protège.");
  if (facts.dlp === "on" && !facts.dlpInScope) residualRisks.push(`La politique DLP ne couvre pas cette configuration (${facts.dlpScopeReason}).`);
  if (facts.httpPolicy === "allowed") residualRisks.push("Le connecteur HTTP n'est pas restreint : un maker peut ajouter un envoi externe.");
  if (facts.authPolicy === "off") residualRisks.push("Aucune politique n'empêche la publication d'un agent sans authentification.");

  const req = scenario.requests.find((x) => x.id === facts.request);
  const decisive = steps.flatMap((x) => x.matched).find((m) => m.decision === "deny" || m.decision === "indeterminate");
  const story: StoryItem[] = [{ actor: "user", label: String(facts.userName), text: req?.text ?? "", tone: "neutral" }];
  if (outcome === "blocked-before-runtime") {
    story.push({ actor: "system", label: "Publication", text: `Agent non publiable. ${decisive?.rationale ?? ""}`, tone: "deny" });
  } else if (outcome === "refused") {
    story.push({ actor: "agent", label: "Agent RH", text: "Je n’ai trouvé aucune information pour répondre à cette question.", tone: "deny" });
  } else if (outcome === "indeterminate") {
    story.push({ actor: "agent", label: "Agent RH", text: "Réponse imprévisible : le comportement de ce chemin n’est pas documenté.", tone: "warn" });
  } else {
    story.push({ actor: "agent", label: `Agent RH · ${facts.targetLabel}`,
      text: `D’après « ${title} » : voici les éléments demandés [extrait fictif].`, tone: objective.met === false ? "warn" : "allow" });
    if (facts.httpNode === "external") story.push({ actor: "attacker", label: "Nœud HTTP", text: "Copie de la réponse envoyée à un service externe.", tone: "attack" });
  }
  return { obtained, refused, auditEvents, objective, residualRisks, story };
};
