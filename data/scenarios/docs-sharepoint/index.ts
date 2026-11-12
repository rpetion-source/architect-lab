import type { Condition, Facts, ParamValues, ScenarioDef } from "../../../lib/types/index.ts";
import type { FactDeriver } from "../../../lib/policy-engine/engine.ts";
import { REF } from "../../sources.ts";
import { basicStory, node, rule, summarizer } from "../_kit.ts";

const lit: Condition = { eq: ["question", "litigation"] };
const m365: Condition = { eq: ["surface", "m365"] };

export const docsScenario: ScenarioDef = {
  id: "docs-sharepoint", version: "0.1.0", title: "Agent documentaire",
  customerRequest: "Je souhaite un assistant qui recherche dans mes documents SharePoint, mais je veux empêcher l'exposition de données confidentielles.",
  businessContext: "Bureau d'études fictif Atlas : un site Projets ouvert et un site Juridique dont un dossier a été partagé par lien « Tout le monde ».",
  objective: "Chacun trouve ses documents ; le contentieux ne remonte que pour le juridique.",
  outcomeLabels: { obtained: "Document trouvé", refused: "Introuvable" },
  serviceAccountGroups: [],
  personas: [
    { id: "julie", name: "Julie Morel", role: "Cheffe de projet", groups: [] },
    { id: "karim", name: "Karim Haddou", role: "Juriste", groups: [] },
  ],
  documents: [
    { id: "proj", title: "Planning projet Atlas", library: "Site Projets", label: "Général", readGroups: [], labelExtractGroups: [], dlpTargetedLabel: false, sensitivity: "internal" },
    { id: "lit", title: "Note de contentieux fournisseur", library: "Site Juridique", label: "Contentieux", readGroups: [], labelExtractGroups: [], dlpTargetedLabel: true, sensitivity: "confidential" },
  ],
  requests: [],
  parameters: [
    { id: "user", label: "Utilisateur", group: "Acteur", default: "julie", options: [{ value: "julie", label: "Julie — Cheffe de projet" }, { value: "karim", label: "Karim — Juriste" }] },
    { id: "question", label: "Question", group: "Demande", default: "litigation", options: [{ value: "project", label: "Planning du projet" }, { value: "litigation", label: "Contentieux fournisseur" }] },
    { id: "surface", label: "Assistant utilisé", group: "Architecture", default: "m365", options: [{ value: "m365", label: "Microsoft 365 Copilot" }, { value: "agent", label: "Agent Copilot Studio (source SharePoint)" }] },
    { id: "overshare", label: "Dossier contentieux", group: "SharePoint", default: "link", options: [{ value: "none", label: "Réservé au juridique" }, { value: "link", label: "Partagé par lien « Tout le monde »" }] },
    { id: "rcd", label: "Restricted Content Discovery (site Juridique)", group: "SharePoint", default: "off", options: [{ value: "off", label: "Désactivé" }, { value: "on", label: "Activé" }] },
    { id: "recent", label: "Julie a déjà ouvert le fichier", group: "SharePoint", default: "no", options: [{ value: "no", label: "Non" }, { value: "yes", label: "Oui" }] },
    { id: "dlp", label: "DLP Copilot sur l'étiquette Contentieux", group: "Purview", default: "off", options: [{ value: "off", label: "Aucune" }, { value: "on", label: "Exclure du traitement" }] },
  ],
  nodes: [
    node("user", "Collaborateur", "Utilisateur Microsoft 365", "actor", 0, 1, "required", { why: "Ses permissions SharePoint sont la vraie frontière.", responsibility: "Cherche un document." }),
    node("copilot", "Assistant", "Microsoft 365 Copilot ou agent Copilot Studio", "agent", 1, 1, "required", { why: "Cherche et résume au nom de l'utilisateur.", responsibility: "Recherche, synthèse, citations.", limits: ["Ne renvoie jamais un contenu que l'utilisateur ne peut pas ouvrir."], refs: [REF.purviewCopilotStudio] }),
    node("spo", "SharePoint", "SharePoint Online", "source", 2, 1, "required", { why: "Les permissions décident de l'accès.", responsibility: "Autorise ou refuse.", limits: ["Un lien « Tout le monde » ouvre l'accès à toute l'organisation."] }),
    node("rcd", "RCD", "SharePoint Advanced Management", "governance-admin", 2, 0, "optional", { why: "Masque un site de la découverte.", responsibility: "Restricted Content Discovery.", limits: ["Ne modifie pas les permissions : l'accès direct reste possible.", "Ne concerne que la recherche à l'échelle du tenant et Microsoft 365 Copilot.", "Prérequis : licence Copilot et SharePoint Advanced Management."], refs: [REF.rcd] }),
    node("dlp", "Purview DLP", "Microsoft Purview DLP (emplacement Copilot)", "data-protection", 2, 2, "recommended", { why: "Exclut une étiquette du traitement.", responsibility: "Politique sur l'emplacement Microsoft 365 Copilot.", refs: [REF.purviewCopilotStudio] }),
    node("answer", "Réponse", "Synthèse et citations", "output", 3, 1, "required", { why: "Ce que voit l'utilisateur.", responsibility: "Résumé avec étiquette." }),
  ],
  edges: [
    { id: "e1", from: "user", to: "copilot", kind: "data", label: "question" },
    { id: "e2", from: "copilot", to: "spo", kind: "api", label: "recherche (identité utilisateur)" },
    { id: "e3", from: "rcd", to: "spo", kind: "governance", label: "site masqué" },
    { id: "e4", from: "dlp", to: "copilot", kind: "policy", label: "exclusion par étiquette" },
    { id: "e5", from: "copilot", to: "answer", kind: "data", label: "synthèse" },
  ],
  steps: [
    { id: "request", order: 1, title: "Question", description: "Document visé.", nodeIds: ["user", "copilot"], edgeIds: ["e1"] },
    { id: "permissions", order: 2, title: "Permissions", description: "L'utilisateur peut-il ouvrir le fichier ?", nodeIds: ["copilot", "spo"], edgeIds: ["e2"] },
    { id: "discovery", order: 3, title: "Découverte", description: "Le site est-il masqué ?", nodeIds: ["rcd", "spo"], edgeIds: ["e3"] },
    { id: "protection", order: 4, title: "Protection", description: "L'étiquette est-elle exclue ?", nodeIds: ["dlp", "copilot"], edgeIds: ["e4"] },
    { id: "answer", order: 5, title: "Réponse", description: "Ce qui est cité.", nodeIds: ["copilot", "answer"], edgeIds: ["e5"] },
  ],
  rules: [
    rule({ id: "DOC-REQ", stepId: "request", priority: 1, product: "—", controlKind: "classification", fallback: true, description: "Document visé.", when: { all: [] }, decision: "observed", risk: "none", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "{userName} cherche « {targetLabel} »." }),
    rule({ id: "DOC-NOACCESS", stepId: "permissions", priority: 1, product: "SharePoint Online", controlKind: "source-authorization", stopsRuntime: true, description: "Aucun accès.", when: { eq: ["hasAccess", false] }, decision: "deny", risk: "none", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "{userName} ne peut pas ouvrir ce fichier : l'assistant ne le renverra jamais." }),
    rule({ id: "DOC-LINK", stepId: "permissions", priority: 2, product: "SharePoint Online", controlKind: "source-authorization", description: "Accès par lien « Tout le monde ».", when: { eq: ["viaLinkOnly", true] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "Le lien « Tout le monde » donne à {userName} un accès réel : l'assistant respecte les permissions, et c'est la permission qui est trop large." }),
    rule({ id: "DOC-PERM-OK", stepId: "permissions", priority: 9, product: "SharePoint Online", controlKind: "source-authorization", fallback: true, description: "Accès prévu.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "{userName} a accès à ce document." }),
    rule({ id: "DOC-RCD-AGENT", stepId: "discovery", priority: 1, product: "SharePoint Advanced Management", controlKind: "admin-governance", description: "RCD et agent Copilot Studio.", when: { all: [{ eq: ["rcd", "on"] }, { eq: ["surface", "agent"] }, lit] }, decision: "not-applicable", risk: "high", confidence: "medium", ref: REF.rcd, rationale: "RCD ne concerne que la recherche à l'échelle du tenant et Microsoft 365 Copilot : un agent Copilot Studio branché sur ce site n'est pas couvert." }),
    rule({ id: "DOC-RCD-RECENT", stepId: "discovery", priority: 2, product: "SharePoint Advanced Management", controlKind: "admin-governance", description: "Fichier récemment ouvert.", when: { all: [{ eq: ["rcd", "on"] }, m365, lit, { eq: ["recent", "yes"] }] }, decision: "indeterminate", risk: "medium", confidence: "low", ref: REF.rcd, rationale: "Historiquement, RCD laissait remonter les fichiers récemment consultés. Microsoft déploie depuis juillet 2026 un changement qui les masque aussi, et la documentation doit être mise à jour : résultat à vérifier sur le tenant." }),
    rule({ id: "DOC-RCD-HIDE", stepId: "discovery", priority: 3, product: "SharePoint Advanced Management", controlKind: "admin-governance", stopsRuntime: true, description: "Site masqué.", when: { all: [{ eq: ["rcd", "on"] }, m365, lit, { eq: ["hasAccess", true] }, { eq: ["recent", "no"] }] }, decision: "deny", risk: "none", confidence: "high", ref: REF.rcd, rationale: "Le site Juridique est masqué de Microsoft 365 Copilot. Les permissions ne changent pas : {userName} peut toujours ouvrir le fichier directement." }),
    rule({ id: "DOC-RCD-NA", stepId: "discovery", priority: 9, product: "—", controlKind: "admin-governance", fallback: true, description: "Aucun masquage.", when: { all: [] }, decision: "not-applicable", risk: "none", confidence: "high", ref: REF.rcd, rationale: "Aucun masquage de découverte ne s'applique ici." }),
    rule({ id: "DOC-DLP", stepId: "protection", priority: 1, product: "Microsoft Purview DLP", controlKind: "data-loss-prevention", stopsRuntime: true, description: "Étiquette exclue.", when: { all: [{ eq: ["dlp", "on"] }, lit] }, decision: "deny", risk: "none", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "La politique DLP sur l'emplacement Copilot exclut l'étiquette « Contentieux » : l'assistant ne traite pas ce fichier — pour personne, juristes compris." }),
    rule({ id: "DOC-LABEL", stepId: "protection", priority: 9, product: "Microsoft Purview", controlKind: "classification", fallback: true, description: "Étiquette affichée.", when: { all: [] }, decision: "observed", risk: "none", confidence: "high", ref: REF.cpsSensitivityLabels, rationale: "L'étiquette « {label} » s'affiche dans la réponse ; elle ne refuse rien seule." }),
    rule({ id: "DOC-LEAK", stepId: "answer", priority: 1, product: "—", controlKind: "source-authorization", description: "Contentieux exposé.", when: { eq: ["exceedsLegit", true] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "{userName} obtient une synthèse de la note de contentieux." }),
    rule({ id: "DOC-ANS", stepId: "answer", priority: 9, product: "—", controlKind: "classification", fallback: true, description: "Réponse.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "Synthèse de « {targetLabel} » avec citations." }),
  ],
  presets: [
    { id: "A", question: "Situation de départ : Julie cherche son planning", title: "A — Document projet", summary: "Julie cherche son planning : trouvé.", params: { question: "project" } },
    { id: "B", question: "Et si Julie cherchait le dossier contentieux ?", title: "B — Lien trop large", summary: "Le lien « Tout le monde » expose le contentieux à Julie.", params: {} },
    { id: "C", question: "Et si on activait Restricted Content Discovery ?", title: "C — RCD dans Copilot", summary: "RCD masque le site Juridique de Microsoft 365 Copilot.", params: { rcd: "on" } },
    { id: "D", question: "Et si Julie passait par un agent Copilot Studio ?", title: "D — RCD et agent", summary: "Même RCD, mais Julie passe par un agent Copilot Studio.", params: { rcd: "on", surface: "agent" } },
    { id: "E", question: "Et si Julie avait déjà ouvert le fichier ?", title: "E — Fichier déjà ouvert", summary: "RCD actif, Julie a déjà ouvert le fichier : comportement en évolution.", params: { rcd: "on", recent: "yes" } },
    { id: "F", question: "Et si une DLP excluait l'étiquette Contentieux ?", title: "F — DLP Copilot", summary: "L'étiquette Contentieux est exclue : bloqué pour tous.", params: { dlp: "on" } },
  ],
  missions: [
    { id: "doc-m1", title: "Prouver qu'un agent Copilot Studio échappe à RCD", hint: "RCD ne protège que certaines surfaces.", success: { all: [{ eq: ["surface", "agent"] }, { eq: ["rcd", "on"] }, { eq: ["user", "julie"] }, { eq: ["outcome", "obtained"] }, lit] }, lesson: "RCD masque ; il ne sécurise pas. Corrigez le lien de partage." },
    { id: "doc-m2", title: "Protéger le contentieux sans bloquer Karim", hint: "Ni RCD, ni DLP : la permission elle-même.", success: { all: [{ eq: ["user", "karim"] }, lit, { eq: ["objectiveMet", "yes"] }, { eq: ["overshare", "none"] }] }, lesson: "La bonne correction est à la source : supprimer le lien « Tout le monde »." },
  ],
};

export const deriveDocs: FactDeriver = (s: ScenarioDef, p: ParamValues): Facts => {
  const u = s.personas.find((x) => x.id === p.user);
  if (!u) throw new Error("Persona inconnue");
  const isLit = p.question === "litigation";
  const member = u.id === "karim";
  const hasAccess = !isLit || member || p.overshare === "link";
  return {
    ...p, userName: u.name, hasAccess, viaLinkOnly: isLit && !member && p.overshare === "link",
    label: isLit ? "Contentieux" : "Général",
    questionText: isLit ? "Résume la note de contentieux avec notre fournisseur." : "Où en est le planning du projet Atlas ?",
    targetLabel: isLit ? "Note de contentieux fournisseur" : "Planning projet Atlas",
    exceedsLegit: isLit && !member && hasAccess, legitRequest: !isLit || member,
  };
};

export const summarizeDocs = summarizer({
  violation: (f) => (f.exceedsLegit ? `${f.userName} lit le contentieux.` : null),
  legit: (f) => f.legitRequest === true,
  okText: (f) => `${f.userName} trouve « ${f.targetLabel} ».`,
  story: (f, o, st) => basicStory(f, o, st, "Assistant", `Synthèse de « ${f.targetLabel} » [contenu fictif] · étiquette ${f.label}.`, f.exceedsLegit === true),
  risks: [
    [(f) => f.overshare === "link", "Le lien « Tout le monde » reste actif : accès direct possible, quoi que fassent RCD ou DLP."],
    [(f) => f.rcd === "on", "RCD masque mais ne retire aucun accès ; il ne couvre pas les agents Copilot Studio."],
    [(f) => f.dlp === "on", "La DLP exclut aussi le contenu pour les juristes : compromis métier."],
  ],
});
