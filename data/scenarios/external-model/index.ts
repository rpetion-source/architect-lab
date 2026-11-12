import type { Condition, Facts, ParamValues, ScenarioDef } from "../../../lib/types/index.ts";
import type { FactDeriver } from "../../../lib/policy-engine/engine.ts";
import { REF } from "../../sources.ts";
import { basicStory, node, rule, summarizer } from "../_kit.ts";

const claude: Condition = { in: ["model", ["claude-azure", "claude-anthropic"]] };
const azureHosted: Condition = { in: ["model", ["gpt-azure", "claude-azure"]] };
const sensitive: Condition = { not: { eq: ["dataClass", "public"] } };
const consumer: Condition = { eq: ["model", "consumer"] };

export const externalModelScenario: ScenarioDef = {
  id: "external-model", version: "0.1.0", title: "Agent avec modèle externe",
  customerRequest: "Je souhaite utiliser Claude ou GPT avec des données d'entreprise et comprendre quelles garanties de gouvernance et de sécurité doivent être mises en place.",
  businessContext: "Assureur fictif Mutalis : une équipe études veut résumer des dossiers clients avec un grand modèle de langage.",
  objective: "Les données restent dans un cadre contractuel connu, dans la bonne géographie, et chacun ne voit que ses dossiers.",
  outcomeLabels: { obtained: "Requête traitée", refused: "Requête bloquée", "blocked-before-runtime": "Mise en production refusée" },
  serviceAccountGroups: [],
  personas: [{ id: "ines", name: "Inès Caron", role: "Chargée d'études", groups: [] }],
  documents: [{ id: "files", title: "Dossiers clients", library: "Applications métier", label: "Données personnelles", readGroups: [], labelExtractGroups: [], dlpTargetedLabel: false, sensitivity: "confidential" }],
  requests: [],
  parameters: [
    { id: "model", label: "Modèle", group: "Architecture", default: "gpt-azure", options: [
      { value: "gpt-azure", label: "GPT — modèle vendu par Azure" }, { value: "claude-azure", label: "Claude dans Foundry — hébergé sur Azure" },
      { value: "claude-anthropic", label: "Claude dans Foundry — hébergé chez Anthropic" }, { value: "consumer", label: "Chatbot grand public (navigateur)" }] },
    { id: "dataClass", label: "Données envoyées", group: "Demande", default: "personal", options: [
      { value: "public", label: "Publiques" }, { value: "internal", label: "Internes" }, { value: "personal", label: "Données personnelles clients" }] },
    { id: "residency", label: "Exigence de résidence", group: "Gouvernance", default: "eu", options: [{ value: "none", label: "Aucune" }, { value: "eu", label: "Traitement dans l'UE" }] },
    { id: "deployment", label: "Type de déploiement (Azure)", group: "Architecture", default: "datazone", options: [{ value: "datazone", label: "DataZone" }, { value: "global", label: "Global" }] },
    { id: "review", label: "Revue juridique du fournisseur", group: "Gouvernance", default: "done", options: [{ value: "done", label: "Faite" }, { value: "pending", label: "Pas encore" }] },
    { id: "grounding", label: "Accès aux dossiers", group: "Architecture", default: "user", options: [
      { value: "user", label: "Recherche avec l'identité utilisateur" }, { value: "noacl", label: "Index sans contrôle d'accès" }] },
    { id: "endpointDlp", label: "Endpoint DLP (sites d'IA tiers)", group: "Purview", default: "off", options: [{ value: "off", label: "Aucune" }, { value: "block", label: "Bloquer le collage sensible" }] },
  ],
  nodes: [
    node("user", "Chargée d'études", "Utilisatrice", "actor", 0, 1, "required", { why: "Choisit l'outil et les données envoyées.", responsibility: "Demande une synthèse." }),
    node("app", "Application IA", "Application d'entreprise (Foundry)", "agent", 1, 1, "required", { why: "Cadre contrôlé : identité, journalisation, choix du modèle.", responsibility: "Assemble le contexte et appelle le modèle." }),
    node("dlp", "Endpoint DLP", "Microsoft Purview DLP (poste)", "data-protection", 1, 0, "optional", { why: "Seul contrôle face à un chatbot grand public.", responsibility: "Avertit ou bloque le collage de données sensibles sur des sites d'IA tiers.", limits: ["Postes Windows intégrés à Purview."], refs: [REF.purviewCopilotStudio] }),
    node("search", "Recherche", "Index des dossiers", "connector", 1, 2, "required", { why: "Fournit le contexte au modèle.", responsibility: "Récupère les dossiers pertinents.", limits: ["Un index sans contrôle d'accès rend tout lisible par tous."] }),
    node("model", "Modèle", "GPT ou Claude", "external", 2, 1, "required", { why: "Le choix du modèle fixe le sous-traitant et la géographie.", responsibility: "Génère la synthèse.", limits: ["Claude dans Foundry : Anthropic est vendeur et sous-traitant indépendant.", "Hébergé chez Anthropic : traitement possible hors Azure."], refs: [REF.azureDirectPrivacy, REF.claudePrivacy, REF.claudeHosting] }),
    node("answer", "Synthèse", "Réponse", "output", 3, 1, "required", { why: "Ce que reçoit l'utilisatrice.", responsibility: "Synthèse du dossier." }),
  ],
  edges: [
    { id: "e1", from: "user", to: "app", kind: "data", label: "demande" },
    { id: "e2", from: "dlp", to: "app", kind: "policy", label: "contrôle du collage" },
    { id: "e3", from: "search", to: "app", kind: "data", label: "dossiers" },
    { id: "e4", from: "app", to: "model", kind: "api", label: "prompt + contexte" },
    { id: "e5", from: "model", to: "answer", kind: "data", label: "synthèse" },
  ],
  steps: [
    { id: "request", order: 1, title: "Données", description: "Que part vers le modèle ?", nodeIds: ["user", "app"], edgeIds: ["e1"] },
    { id: "channel", order: 2, title: "Canal", description: "Application d'entreprise ou site grand public ?", nodeIds: ["dlp", "app"], edgeIds: ["e2"] },
    { id: "grounding", order: 3, title: "Accès aux dossiers", description: "Le contexte respecte-t-il les droits ?", nodeIds: ["search", "app"], edgeIds: ["e3"] },
    { id: "processor", order: 4, title: "Sous-traitant", description: "Qui traite les données, sous quelles conditions ?", nodeIds: ["app", "model"], edgeIds: ["e4"] },
    { id: "residency", order: 5, title: "Géographie", description: "Où les données sont-elles traitées ?", nodeIds: ["model"], edgeIds: [] },
    { id: "answer", order: 6, title: "Réponse", description: "Synthèse renvoyée.", nodeIds: ["model", "answer"], edgeIds: ["e5"] },
  ],
  rules: [
    rule({ id: "EXT-REQ", stepId: "request", priority: 1, product: "—", controlKind: "classification", fallback: true, description: "Classe des données.", when: { all: [] }, decision: "observed", risk: "none", confidence: "high", ref: REF.azureDirectPrivacy, rationale: "Données envoyées : {dataLabel}." }),
    rule({ id: "EXT-EDLP", stepId: "channel", priority: 1, product: "Microsoft Purview Endpoint DLP", controlKind: "data-loss-prevention", stopsRuntime: true, description: "Collage bloqué.", when: { all: [consumer, sensitive, { eq: ["endpointDlp", "block"] }] }, decision: "deny", risk: "none", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "Endpoint DLP bloque le collage de données sensibles sur un site d'IA générative tiers (poste Windows intégré à Purview)." }),
    rule({ id: "EXT-SHADOW", stepId: "channel", priority: 2, product: "—", controlKind: "data-loss-prevention", description: "IA fantôme.", when: { all: [consumer, sensitive, { eq: ["endpointDlp", "off"] }] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "Les données sont collées dans un chatbot grand public : hors des contrats de l'entreprise, sans journal ni contrôle d'accès." }),
    rule({ id: "EXT-APP", stepId: "channel", priority: 9, product: "Application d'entreprise", controlKind: "authentication", fallback: true, description: "Canal d'entreprise.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.azureDirectPrivacy, rationale: "Passage par l'application d'entreprise : identité, journalisation, modèle contractualisé." }),
    rule({ id: "EXT-NOACL", stepId: "grounding", priority: 1, product: "Index de recherche", controlKind: "source-authorization", description: "Index sans contrôle d'accès.", when: { all: [{ not: consumer }, { eq: ["grounding", "noacl"] }, sensitive] }, decision: "allow", risk: "critical", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "L'index ne filtre pas par utilisateur : {userName} peut faire résumer n'importe quel dossier client." }),
    rule({ id: "EXT-GROUND-NA", stepId: "grounding", priority: 2, product: "—", controlKind: "source-authorization", description: "Pas de recherche.", when: consumer, decision: "not-applicable", risk: "none", confidence: "high", ref: REF.purviewCopilotStudio, rationale: "Le chatbot grand public ne passe pas par l'index de l'entreprise : les données y sont collées à la main." }),
    rule({ id: "EXT-GROUND", stepId: "grounding", priority: 9, product: "Index de recherche", controlKind: "source-authorization", fallback: true, description: "Droits respectés.", when: { all: [] }, decision: "allow", risk: "none", confidence: "medium", ref: REF.purviewCopilotStudio, rationale: "La recherche s'exécute avec l'identité de {userName} : seuls ses dossiers sont fournis au modèle." }),
    rule({ id: "EXT-REVIEW", stepId: "processor", priority: 1, product: "Gouvernance interne", controlKind: "admin-governance", preRuntime: true, description: "Revue juridique manquante.", when: { all: [claude, { eq: ["review", "pending"] }, { eq: ["dataClass", "personal"] }] }, decision: "deny", risk: "none", confidence: "high", ref: REF.claudePrivacy, rationale: "Avec Claude dans Foundry, on accepte les conditions d'Anthropic, sous-traitant indépendant : pas de données personnelles avant la revue juridique (règle interne du scénario)." }),
    rule({ id: "EXT-CLAUDE", stepId: "processor", priority: 2, product: "Claude dans Microsoft Foundry", controlKind: "admin-governance", description: "Anthropic sous-traitant indépendant.", when: claude, decision: "conditional", risk: "low", confidence: "high", ref: REF.claudePrivacy, rationale: "Anthropic est le vendeur et le sous-traitant indépendant des prompts et sorties, dans les deux modes d'hébergement." }),
    rule({ id: "EXT-CONSUMER", stepId: "processor", priority: 3, product: "—", controlKind: "admin-governance", description: "Hors contrat.", when: consumer, decision: "allow", risk: "high", confidence: "medium", ref: REF.azureDirectPrivacy, rationale: "Les conditions d'un service grand public ne sont pas celles des contrats Microsoft de l'entreprise." }),
    rule({ id: "EXT-AZURE", stepId: "processor", priority: 9, product: "Modèle vendu par Azure", controlKind: "admin-governance", fallback: true, description: "Cadre Azure.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.azureDirectPrivacy, rationale: "Modèle vendu par Azure : traitement régi par le DPA Microsoft ; prompts et réponses ne servent pas à améliorer des produits sans autorisation." }),
    rule({ id: "EXT-RES-ANTH", stepId: "residency", priority: 1, product: "Claude hébergé chez Anthropic", controlKind: "admin-governance", preRuntime: true, description: "Traitement possible hors Azure.", when: { all: [{ eq: ["model", "claude-anthropic"] }, { eq: ["residency", "eu"] }] }, decision: "deny", risk: "none", confidence: "high", ref: REF.claudeHosting, rationale: "Hébergé chez Anthropic, le traitement peut avoir lieu hors d'Azure et hors de la géographie choisie : incompatible avec l'exigence UE." }),
    rule({ id: "EXT-RES-GLOBAL", stepId: "residency", priority: 2, product: "Déploiement Global", controlKind: "admin-governance", preRuntime: true, description: "Déploiement Global.", when: { all: [azureHosted, { eq: ["residency", "eu"] }, { eq: ["deployment", "global"] }] }, decision: "deny", risk: "none", confidence: "medium", ref: REF.azureDirectPrivacy, rationale: "Un déploiement Global peut traiter les requêtes hors de la zone : préférer DataZone pour une exigence UE." }),
    rule({ id: "EXT-RES-CONS", stepId: "residency", priority: 3, product: "—", controlKind: "admin-governance", description: "Géographie inconnue.", when: { all: [consumer, { eq: ["residency", "eu"] }] }, decision: "indeterminate", risk: "high", confidence: "low", ref: REF.azureDirectPrivacy, rationale: "Lieu de traitement du service grand public inconnu dans ce scénario." }),
    rule({ id: "EXT-RES-OK", stepId: "residency", priority: 9, product: "Microsoft Foundry", controlKind: "admin-governance", fallback: true, description: "Géographie conforme.", when: { all: [] }, decision: "allow", risk: "none", confidence: "medium", ref: REF.claudeHosting, rationale: "Données au repos dans la géographie choisie ; traitement limité par le type de déploiement." }),
    rule({ id: "EXT-ANS", stepId: "answer", priority: 9, product: "—", controlKind: "classification", fallback: true, description: "Synthèse.", when: { all: [] }, decision: "allow", risk: "none", confidence: "high", ref: REF.azureDirectPrivacy, rationale: "Synthèse renvoyée à {userName}." }),
  ],
  presets: [
    { id: "A", question: "Situation de départ : GPT dans Azure, données en Europe", title: "A — GPT vendu par Azure", summary: "DataZone UE, recherche avec l'identité : cadre maîtrisé.", params: {} },
    { id: "B", question: "Et si on passait à Claude hébergé sur Azure ?", title: "B — Claude sur Azure", summary: "Claude hébergé sur Azure, revue juridique faite : conditionnel.", params: { model: "claude-azure" } },
    { id: "C", question: "Et si Claude était hébergé chez Anthropic ?", title: "C — Claude chez Anthropic", summary: "Exigence UE : mise en production refusée.", params: { model: "claude-anthropic" } },
    { id: "D", question: "Et si Inès collait les dossiers dans un chatbot public ?", title: "D — Chatbot grand public", summary: "Dossiers collés dans un chatbot public : IA fantôme.", params: { model: "consumer", residency: "none" } },
    { id: "E", question: "Et si Endpoint DLP surveillait les postes ?", title: "E — Endpoint DLP", summary: "Même geste, Endpoint DLP bloque le collage.", params: { model: "consumer", residency: "none", endpointDlp: "block" } },
    { id: "F", question: "Et si l'index ignorait les droits d'accès ?", title: "F — Index sans ACL", summary: "Bon modèle, mauvais index : tout le monde lit tout.", params: { grounding: "noacl" } },
  ],
  missions: [
    { id: "ext-m1", title: "Utiliser Claude avec des données personnelles, en restant dans l'UE", hint: "Hébergement et revue comptent tous les deux.", success: { all: [{ eq: ["model", "claude-azure"] }, { eq: ["dataClass", "personal"] }, { eq: ["residency", "eu"] }, { eq: ["objectiveMet", "yes"] }] }, lesson: "Le choix d'hébergement et la revue contractuelle sont des contrôles d'architecture à part entière." },
    { id: "ext-m2", title: "Montrer qu'un bon modèle ne suffit pas", hint: "Regardez ce qu'on donne au modèle, pas le modèle.", success: { all: [{ eq: ["model", "gpt-azure"] }, { eq: ["objectiveMet", "no"] }] }, lesson: "La fuite vient souvent du contexte (index sans ACL), pas du modèle." },
  ],
};

export const deriveExternal: FactDeriver = (_s: ScenarioDef, p: ParamValues): Facts => ({
  ...p, userName: "Inès Caron",
  dataLabel: { public: "informations publiques", internal: "documents internes", personal: "données personnelles de clients" }[p.dataClass ?? "public"] ?? "",
  questionText: "Résume les dossiers de sinistres du mois.", targetLabel: "Synthèse des dossiers",
});

export const summarizeExternal = summarizer({
  violation: (f) => (f.model === "consumer" && f.dataClass !== "public" ? "des données d'entreprise partent dans un service grand public." : f.grounding === "noacl" && f.dataClass !== "public" ? "le modèle reçoit des dossiers que l'utilisatrice ne devrait pas voir." : null),
  // Une configuration hors exigences (géographie, revue) n'est pas une demande légitime : la bloquer est le bon résultat.
  legit: (f) => (f.model !== "consumer" || f.dataClass === "public")
    && !(f.residency === "eu" && (f.model === "claude-anthropic" || (f.model !== "consumer" && f.deployment === "global")))
    && !(String(f.model).startsWith("claude") && f.review === "pending" && f.dataClass === "personal"),
  okText: (f) => `synthèse produite dans un cadre maîtrisé (${f.model === "gpt-azure" ? "modèle vendu par Azure" : "Claude dans Foundry"}).`,
  story: (f, o, st) => basicStory(f, o, st, f.model === "consumer" ? "Chatbot public" : "Application IA", "Synthèse : 42 dossiers, 3 litiges à suivre [fictif].", f.model === "consumer" || f.grounding === "noacl"),
  risks: [
    [(f) => f.endpointDlp === "off", "Rien n'empêche le collage de données dans des sites d'IA grand public."],
    [(f) => f.grounding === "noacl", "Index sans contrôle d'accès."],
    [(f) => f.model === "claude-azure" || f.model === "claude-anthropic", "Conditions d'Anthropic à suivre dans le temps (sous-traitant indépendant)."],
  ],
});
