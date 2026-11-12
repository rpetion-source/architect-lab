import type { Facts, ParamValues, ScenarioDef, StoryItem } from "../../../lib/types/index.ts";
import type { FactDeriver, OutcomeSummarizer } from "../../../lib/policy-engine/engine.ts";

export const COLUMNS = ["Région", "Client", "Produit", "Montant", "Marge", "E-mail client"] as const;
type Col = (typeof COLUMNS)[number];
const SENSITIVE: Col[] = ["Marge", "E-mail client"];

export const ROWS: { id: string; cells: string[] }[] = [
  { id: "r1", cells: ["Nord", "Boulangerie Martin", "Four pro", "12 400 €", "31 %", "achat@martin.example"] },
  { id: "r2", cells: ["Nord", "Garage Leroy", "Compresseur", "8 900 €", "22 %", "compta@leroy.example"] },
  { id: "r3", cells: ["Sud", "Hôtel Azur", "Lave-linge", "15 200 €", "27 %", "direction@azur.example"] },
  { id: "r4", cells: ["Sud", "Clinique Vétérinaire", "Autoclave", "21 000 €", "35 %", "admin@clinvet.example"] },
  { id: "r5", cells: ["Est", "Brasserie Kolb", "Cuve inox", "33 500 €", "18 %", "brasseur@kolb.example"] },
  { id: "r6", cells: ["Ouest", "Ferme Le Gall", "Trayeuse", "27 800 €", "24 %", "legall@ferme.example"] },
];
const isNord = (row: { cells: string[] }) => row.cells[0] === "Nord";

interface RoleDef { roleName: string; rls: string | null; rowFilter: (r: { cells: string[] }) => boolean; cls: Col[] }
const ROLES: Record<string, RoleDef | undefined> = {
  nadia: { roleName: "Ventes-Nord", rls: "Région = 'Nord'", rowFilter: isNord, cls: ["Région", "Client", "Produit", "Montant"] },
  hugo: { roleName: "Finance", rls: null, rowFilter: () => true, cls: ["Région", "Client", "Produit", "Montant", "Marge"] },
};
/** Ce que chaque équipe doit voir selon la conception. */
const LEGIT: Record<string, { rows: (r: { cells: string[] }) => boolean; cols: Col[] }> = {
  nadia: { rows: isNord, cols: ["Région", "Client", "Produit", "Montant"] },
  hugo: { rows: () => true, cols: ["Région", "Client", "Produit", "Montant", "Marge"] },
  lea: { rows: () => true, cols: [...COLUMNS] },
};
const REQUESTED: Record<string, Col[]> = {
  ca: ["Région", "Client", "Montant"],
  marges: ["Région", "Produit", "Marge"],
  "select-star": [...COLUMNS],
};
const ENGINE_LABEL: Record<string, string> = {
  sql: "point de terminaison SQL", spark: "notebook Spark", "ext-authorized": "moteur tiers autorisé", "ext-unauthorized": "moteur tiers non autorisé",
};
const list = (a: string[]) => (a.length ? a.join(", ") : "aucune");

export const deriveFabricFacts: FactDeriver = (scenario: ScenarioDef, p: ParamValues): Facts => {
  const user = scenario.personas.find((x) => x.id === p.user);
  if (!user) throw new Error(`Persona introuvable : ${p.user}`);
  const requested = REQUESTED[p.question ?? ""];
  if (!requested) throw new Error(`Question inconnue : ${p.question}`);
  const legit = LEGIT[user.id];
  if (!legit) throw new Error(`Besoin légitime non défini : ${user.id}`);

  const isSpn = p.identity === "spn";
  const baseRole = user.groups.includes("contributor") ? "contributor" : "viewer";
  const wsRole = isSpn || p.promote === "contributor" ? "contributor" : baseRole;
  const bypass = wsRole === "contributor";
  const defaultReaderGrant = !bypass && p.readAll === "yes" && p.defaultReader === "kept";
  const role = !bypass && !defaultReaderGrant ? ROLES[user.id] : undefined;
  const rlsActive = !!role?.rls;
  const clsActive = !!role && role.cls.length < COLUMNS.length;

  const visibleCols: Col[] = role ? role.cls : [...COLUMNS];
  const visibleRows = ROWS.filter((row) => (role ? role.rowFilter(row) : true));
  const forbidden = requested.filter((c) => !visibleCols.includes(c));
  const returnedCols = requested.filter((c) => visibleCols.includes(c));
  const extraRows = visibleRows.filter((row) => !legit.rows(row));
  const extraCols = returnedCols.filter((c) => !legit.cols.includes(c));
  const extraRegions = [...new Set(extraRows.map((row) => row.cells[0] ?? ""))];
  const extraParts = [
    extraRegions.length ? `les régions ${extraRegions.join(", ")}` : "",
    extraCols.length ? `la colonne ${extraCols.join(", ")}` : "",
  ].filter(Boolean);

  return {
    ...p,
    userName: user.name,
    userRole: user.role,
    principalName: isSpn ? "le principal de service de l'agent" : user.name,
    wsRoleLabel: "Contributor",
    bypass,
    bypassIllegit: bypass && user.id !== "lea",
    defaultReaderGrant,
    rlsActive,
    clsActive,
    subjectToFilters: rlsActive || clsActive,
    splitApplies: p.roleDesign === "split" && rlsActive && clsActive,
    roleName: role?.roleName ?? "aucun",
    rowRule: role?.rls ?? "toutes",
    colRule: list(visibleCols),
    requestedCols: list(requested),
    forbiddenCols: list(forbidden),
    requestsForbiddenCol: forbidden.length > 0,
    returnedCols: list(returnedCols),
    visibleRowCount: String(visibleRows.length),
    totalRows: String(ROWS.length),
    exceedsLegit: extraParts.length > 0,
    extraData: extraParts.join(" et ") || "rien de plus",
    legitAllowsRequest: p.question === "select-star" || requested.every((c) => legit.cols.includes(c)),
    engineLabel: ENGINE_LABEL[p.engine ?? ""] ?? "moteur",
    // Données sérialisées pour la vue tabulaire (déterministes).
    visibleRowIds: visibleRows.map((row) => row.id).join(","),
    returnedColList: returnedCols.join("|"),
    requestedColList: requested.join("|"),
  };
};

export const summarizeFabric: OutcomeSummarizer = ({ facts, steps, outcome }) => {
  const ok = outcome === "obtained";
  const rowIds = String(facts.visibleRowIds).split(",");
  const returned = String(facts.returnedColList).split("|");
  const requested = String(facts.requestedColList).split("|");
  const table = {
    title: "Table Ventes — ce que l'agent reçoit",
    columns: COLUMNS.map((c) => ({ name: c, visible: ok && returned.includes(c), requested: requested.includes(c), sensitive: SENSITIVE.includes(c) })),
    rows: ROWS.map((row) => ({ id: row.id, cells: row.cells, visible: ok && rowIds.includes(row.id) })),
    note: ok ? `${facts.visibleRowCount} ligne(s) sur ${facts.totalRows} · colonnes : ${facts.returnedCols}` : "Aucune donnée renvoyée.",
  };

  let objective: { met: boolean | null; explanation: string };
  if (outcome === "indeterminate") objective = { met: null, explanation: "Impossible de conclure : un comportement décisif n'est pas simulé ou pas documenté." };
  else if (ok && facts.exceedsLegit) objective = { met: false, explanation: `Fuite : ${facts.userName} reçoit ${facts.extraData}.` };
  else if (ok) objective = { met: true, explanation: `Objectif atteint : ${facts.userName} reçoit exactement ce que son équipe doit voir.` };
  else if (facts.legitAllowsRequest) objective = { met: false, explanation: `Sécurisé, mais une requête légitime de ${facts.userName} échoue : l'équipe est bloquée.` };
  else objective = { met: true, explanation: `Objectif atteint : ${facts.userName} n'obtient pas une colonne réservée à une autre équipe.` };

  const decisive = steps.flatMap((s) => s.matched).find((m) => m.decision === "deny" || m.decision === "indeterminate");
  const story: StoryItem[] = [
    { actor: "user", label: String(facts.userName), text: String({ ca: "Quel chiffre d'affaires par client ?", marges: "Quelle marge par produit ?", "select-star": "Montre-moi toute la table." }[String(facts.question)]), tone: "neutral" },
    { actor: "agent", label: "Agent d'analyse", text: `Requête envoyée au ${facts.engineLabel} avec ${facts.identity === "spn" ? "le principal de service de l'agent" : "l'identité de l'utilisateur"}.`, tone: "info" },
  ];
  if (ok) story.push({ actor: "tool", label: "OneLake", text: table.note, tone: facts.exceedsLegit ? "warn" : "allow" });
  else story.push({ actor: "system", label: outcome === "indeterminate" ? "À vérifier" : "Erreur de requête", text: decisive?.rationale ?? "", tone: outcome === "indeterminate" ? "warn" : "deny" });

  const residualRisks: string[] = [];
  if (facts.identity === "spn") residualRisks.push("Un agent en principal de service Contributor ignore RLS et CLS pour tous ses utilisateurs.");
  if (facts.promote === "contributor") residualRisks.push("Des utilisateurs métier Contributor contournent OneLake security.");
  if (facts.readAll === "yes" && facts.defaultReader === "kept") residualRisks.push("DefaultReader intact sur un élément partagé avec ReadAll.");
  if (facts.diagnostics === "off") residualRisks.push("Aucune trace des accès aux données (OneLake diagnostics désactivé).");
  if (facts.engine === "ext-authorized") residualRisks.push("Moteur tiers autorisé en Preview : valider son application de RLS/CLS.");
  if (facts.roleDesign === "split") residualRisks.push("Rôles RLS et CLS séparés : erreurs pour les membres des deux rôles.");

  return {
    obtained: ok ? [table.note] : [],
    refused: !ok && outcome !== "indeterminate" ? ["Table Ventes"] : [],
    auditEvents: facts.diagnostics === "on" && steps.find((s) => s.stepId === "audit")?.decision !== "not-applicable"
      ? ["OneLake diagnostics : accès à la table Ventes"] : [],
    objective, residualRisks, story, table,
  };
};
