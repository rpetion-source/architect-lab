(() => {
"use strict";
const L = window.Lab;
const { SCENARIOS, simulate, resolveParams, diffResults, evaluateCondition, missionAchieved, OUTCOME_LABEL } = L;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const DEC = { allow: "Autorisé", deny: "Refusé", conditional: "Conditionnel", "not-applicable": "Non applicable", observed: "Observé", indeterminate: "Indéterminé" };
const DEC_VAR = { allow: "--allow", deny: "--deny", conditional: "--cond", "not-applicable": "--na", observed: "--obs", indeterminate: "--indet" };
const DEC_GLYPH = { allow: "✓", deny: "✕", conditional: "!", "not-applicable": "–", observed: "•", indeterminate: "?" };
const RISK = { none: "aucun", low: "faible", medium: "moyen", high: "élevé", critical: "critique" };
const RR = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
const CONF = { high: "haute", medium: "moyenne", low: "faible" };
const STATUS = { GA: "GA", Preview: "Preview", Unstated: "statut non précisé", Unverified: "page non relue" };
const NEED = { required: "Indispensable", recommended: "Recommandé", optional: "Facultatif" };
const CTRL = { authentication: "Authentification", "source-authorization": "Autorisation à la source", classification: "Classification", "data-loss-prevention": "Prévention des fuites", monitoring: "Surveillance", audit: "Audit", "threat-detection": "Détection des menaces", "admin-governance": "Gouvernance administrative", "identity-resolution": "Résolution d’identité" };
const FLOWS = [
  { k: "data", label: "Données", dash: "", v: "--f-data" },
  { k: "api", label: "Appels API / outil", dash: "7 4", v: "--f-api" },
  { k: "auth", label: "Authentification", dash: "2 4", v: "--f-auth" },
  { k: "policy", label: "Politique", dash: "10 3 2 3", v: "--f-policy" },
  { k: "telemetry", label: "Journalisation", dash: "1 5", v: "--f-tele" },
  { k: "governance", label: "Gouvernance (sans flux)", dash: "", v: "--f-gov" },
];
const KIND = {
  actor: { v: "--k-actor", d: "M10 9.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM3.5 17c.6-3.4 3.2-5.2 6.5-5.2s5.9 1.8 6.5 5.2" },
  identity: { v: "--k-identity", d: "M7 12.5a3.8 3.8 0 1 1 3.2-1.8L17 17.5M14 14.5l1.8-1.8M12.2 16.3l1.4-1.4" },
  agent: { v: "--k-agent", d: "M5 7h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM10 7V4M7.5 11.5h.01M12.5 11.5h.01M8 14h4" },
  "governance-admin": { v: "--k-gov", d: "M4 6h12M4 10h12M4 14h12M7 4v4M13 8v4M9 12v4" },
  connector: { v: "--k-connector", d: "M7 3v4M13 3v4M5 7h10v3a5 5 0 0 1-10 0V7ZM10 15v3" },
  source: { v: "--k-source", d: "M3.5 5.5c0-1.4 2.9-2.5 6.5-2.5s6.5 1.1 6.5 2.5v9c0 1.4-2.9 2.5-6.5 2.5s-6.5-1.1-6.5-2.5v-9ZM3.5 5.5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5M3.5 10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5" },
  "data-protection": { v: "--k-protect", d: "M10 2.8 16 5v4.6c0 3.7-2.6 6.4-6 7.6-3.4-1.2-6-3.9-6-7.6V5l6-2.2ZM7.4 10l1.9 1.9 3.4-3.6" },
  audit: { v: "--k-audit", d: "M5.5 2.8h6.5L15 5.8v11.4H5.5V2.8ZM8 9h4.5M8 12h4.5M8 15h2.5" },
  output: { v: "--k-output", d: "M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H9l-3.8 3v-3H5.5a2 2 0 0 1-2-2V5.5Z" },
  external: { v: "--k-external", d: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM3 10h14M10 3c2 2 2.8 4.4 2.8 7s-.8 5-2.8 7c-2-2-2.8-4.4-2.8-7S8 5 10 3Z" },
};
const badge = (d) => `<span class="badge d-${d}">${DEC_GLYPH[d]} ${DEC[d]}</span>`;
const refLink = (r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a> — ${STATUS[r.status]}, vérifié le ${r.verifiedOn}`;
const icon = (kind, size = 20) => { const k = KIND[kind] ?? KIND.actor; return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="${k.d}" fill="none" stroke="var(${k.v})" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`; };

// ---------------------------------------------------------------- Dessins cartoon
const SKIN = ["#FFD7B5", "#F1B98C", "#C68B59", "#8D5524", "#FFE3CC"];
const HAIR = ["#3B2A1A", "#F2B134", "#C2410C", "#1E1B3A", "#7C4DFF", "#E11D48"];
const hash = (x) => { let h = 7; for (const c of String(x)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
/** Visage original généré à partir d'une graine (aucun personnage existant). */
function faceG(seed, cx, cy, r, mood = "smile") {
  const h = hash(seed), skin = SKIN[h % SKIN.length], hair = HAIR[(h >> 3) % HAIR.length], style = (h >> 6) % 3;
  const hc = cy + r * 0.12, hr = r * 0.62;
  const cap = `M${cx - hr - 1.5} ${hc} A${hr + 1.5} ${hr + 1.5} 0 0 1 ${cx + hr + 1.5} ${hc} Q${cx + hr * 0.2} ${hc - hr * 0.42} ${cx - hr - 1.5} ${hc} Z`;
  const extra = style === 1 ? `<circle cx="${cx}" cy="${hc - hr * 1.02}" r="${hr * 0.36}" fill="${hair}" stroke="var(--outline)" stroke-width="1.8"/>` : style === 2 ? `<path d="M${cx - hr - 1.5} ${hc} q-${hr * 0.25} ${hr * 0.7} ${hr * 0.15} ${hr * 0.95}" fill="none" stroke="${hair}" stroke-width="${hr * 0.35}" stroke-linecap="round"/>` : "";
  const mouth = mood === "worried" ? `<ellipse cx="${cx}" cy="${hc + hr * 0.5}" rx="${hr * 0.14}" ry="${hr * 0.17}" fill="var(--outline)"/>` : `<path d="M${cx - hr * 0.32} ${hc + hr * 0.4} Q${cx} ${hc + hr * 0.72} ${cx + hr * 0.32} ${hc + hr * 0.4}" fill="none" stroke="var(--outline)" stroke-width="1.8" stroke-linecap="round"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--c${1 + (h % 8)})" stroke="var(--outline)" stroke-width="2"/>${extra}
    <circle cx="${cx}" cy="${hc}" r="${hr}" fill="${skin}" stroke="var(--outline)" stroke-width="1.8"/><path d="${cap}" fill="${hair}" stroke="var(--outline)" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="${cx - hr * 0.33}" cy="${hc + hr * 0.12}" r="${Math.max(1.4, hr * 0.1)}" fill="var(--outline)"/><circle cx="${cx + hr * 0.33}" cy="${hc + hr * 0.12}" r="${Math.max(1.4, hr * 0.1)}" fill="var(--outline)"/>
    <circle cx="${cx - hr * 0.55}" cy="${hc + hr * 0.38}" r="${hr * 0.13}" fill="#FF6B9D" opacity=".45"/><circle cx="${cx + hr * 0.55}" cy="${hc + hr * 0.38}" r="${hr * 0.13}" fill="#FF6B9D" opacity=".45"/>${mouth}`;
}
/** Mascotte robot du labo. */
function robotG(cx, cy, r, mood = "smile") {
  const w = r * 1.55, h = r * 1.2, x = cx - w / 2, y = cy - h / 2 + r * 0.15;
  const mouth = mood === "worried" ? `<ellipse cx="${cx}" cy="${y + h * 0.74}" rx="${r * 0.12}" ry="${r * 0.14}" fill="var(--outline)"/>` : mood === "wow" ? `<path d="M${cx - r * 0.3} ${y + h * 0.68} h${r * 0.6}" stroke="var(--outline)" stroke-width="2" stroke-linecap="round"/>` : `<path d="M${cx - r * 0.3} ${y + h * 0.66} Q${cx} ${y + h * 0.88} ${cx + r * 0.3} ${y + h * 0.66}" fill="none" stroke="var(--outline)" stroke-width="2" stroke-linecap="round"/>`;
  return `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y - r * 0.38}" stroke="var(--outline)" stroke-width="2.2"/><circle cx="${cx}" cy="${y - r * 0.45}" r="${r * 0.14}" fill="var(--accent-2)" stroke="var(--outline)" stroke-width="1.8"/>
    <rect x="${x - r * 0.1}" y="${y + h * 0.3}" width="${r * 0.2}" height="${h * 0.35}" rx="${r * 0.08}" fill="var(--c2)" stroke="var(--outline)" stroke-width="1.6"/><rect x="${x + w - r * 0.1}" y="${y + h * 0.3}" width="${r * 0.2}" height="${h * 0.35}" rx="${r * 0.08}" fill="var(--c2)" stroke="var(--outline)" stroke-width="1.6"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r * 0.35}" fill="var(--c4)" stroke="var(--outline)" stroke-width="2.2"/>
    <rect x="${x + w * 0.12}" y="${y + h * 0.16}" width="${w * 0.76}" height="${h * 0.66}" rx="${r * 0.25}" fill="#fff" stroke="var(--outline)" stroke-width="1.6"/>
    <circle cx="${cx - r * 0.3}" cy="${y + h * 0.42}" r="${r * 0.12}" fill="var(--outline)"/><circle cx="${cx + r * 0.3}" cy="${y + h * 0.42}" r="${r * 0.12}" fill="var(--outline)"/>${mouth}`;
}
/** Pirate masqué pour les attaques (personnage original). */
function attackerG(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--deny)" stroke="var(--outline)" stroke-width="2"/><circle cx="${cx}" cy="${cy + r * 0.1}" r="${r * 0.62}" fill="#3A2F5B" stroke="var(--outline)" stroke-width="1.8"/>
    <rect x="${cx - r * 0.62}" y="${cy - r * 0.1}" width="${r * 1.24}" height="${r * 0.32}" rx="${r * 0.12}" fill="var(--outline)"/><circle cx="${cx - r * 0.25}" cy="${cy + r * 0.06}" r="${r * 0.09}" fill="#fff"/><circle cx="${cx + r * 0.25}" cy="${cy + r * 0.06}" r="${r * 0.09}" fill="#fff"/>
    <path d="M${cx - r * 0.22} ${cy + r * 0.45} q${r * 0.22} -${r * 0.15} ${r * 0.44} 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
}
function burstG(cx, cy, label, color) {
  const pts = [];
  for (let i = 0; i < 24; i++) { const a = (Math.PI * 2 * i) / 24, rr = i % 2 ? 22 : 31; pts.push(`${(cx + Math.cos(a) * rr * 1.45).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`); }
  return `<g class="burst"><polygon points="${pts.join(" ")}" fill="${color}" stroke="var(--outline)" stroke-width="2.5" stroke-linejoin="round"/><text x="${cx}" y="${cy + 5.5}" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="16" fill="#fff" stroke="var(--outline)" stroke-width="3" paint-order="stroke">${label}</text></g>`;
}
const avatarSvg = (inner, size = 40) => `<svg class="av" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">${inner}</svg>`;

// ---------------------------------------------------------------- Défis (mémorisés dans ce navigateur)
const MKEY = "archlab-missions-v1";
let done = new Set();
try { done = new Set(JSON.parse(localStorage.getItem(MKEY) || "[]")); } catch { done = new Set(); }
const saveDone = () => { try { localStorage.setItem(MKEY, JSON.stringify([...done])); } catch { /* stockage indisponible */ } };
const allMissions = () => SCENARIOS.flatMap((e) => e.scenario.missions);

// ---------------------------------------------------------------- État
const st = { entry: null, params: null, preset: null, result: null, before: null, changedSteps: [], idx: -1, phase: "ask", playing: false, speed: 1, timer: null,
  view: null, flows: new Set(FLOWS.map((f) => f.k)), vb: null, fit: null, follow: true };
const SC = () => st.entry.scenario;
const run = (p) => simulate(SC(), p, st.entry.derive, st.entry.summarize);
const outcomeLabel = (o) => SC().outcomeLabels?.[o] ?? OUTCOME_LABEL[o];
const last = () => st.result.steps.length - 1;

// ---------------------------------------------------------------- Illustrations
function cardArt(kind) {
  if (!["hr", "lake", "tools"].includes(kind)) return cardArtGeneric(kind);
  const bg = `<rect width="320" height="112" fill="color-mix(in srgb,var(${ART_BG[kind] ?? "--c5"}) 45%,var(--surface))"/><circle cx="292" cy="16" r="28" fill="#fff" opacity=".35"/>`;
  if (kind === "hr") return `<svg class="art" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${bg}
    <g transform="translate(40 22)"><rect width="58" height="72" rx="6" fill="var(--surface)" stroke="var(--line)"/><rect x="10" y="8" width="58" height="72" rx="6" fill="var(--surface)" stroke="var(--line)"/><path d="M20 26h36M20 36h30M20 46h36M20 56h22" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/></g>
    <path d="M118 58h70" stroke="var(--f-api)" stroke-width="2.5" stroke-dasharray="7 5"/><circle r="6" fill="var(--deny)"><animateMotion dur="2.4s" repeatCount="indefinite" path="M118 58h62"/></circle>
    <g transform="translate(196 18)"><path d="M38 4 70 15v23c0 19-13 33-32 39C19 71 6 57 6 38V15L38 4Z" fill="color-mix(in srgb,var(--k-protect) 18%,var(--surface))" stroke="var(--k-protect)" stroke-width="3"/><path d="M27 41l8 8 15-17" fill="none" stroke="var(--k-protect)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
  if (kind === "lake") {
    const cells = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const hidden = c >= 4 || r >= 2;
      cells.push(`<rect x="${60 + c * 34}" y="${18 + r * 20}" width="30" height="16" rx="3" fill="${hidden ? "var(--line)" : "color-mix(in srgb,var(--k-source) 35%,var(--surface))"}" opacity="${hidden ? .55 : 1}"/>`);
    }
    return `<svg class="art" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${bg}${cells.join("")}
      <rect x="56" y="54" width="208" height="42" rx="6" fill="none" stroke="var(--deny)" stroke-width="2" stroke-dasharray="5 4"/><rect x="192" y="14" width="72" height="86" rx="6" fill="none" stroke="var(--cond)" stroke-width="2" stroke-dasharray="5 4"/>
      </svg>`;
  }
  return `<svg class="art" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${bg}
    <g transform="translate(36 30)"><rect width="66" height="50" rx="12" fill="color-mix(in srgb,var(--k-agent) 22%,var(--surface))" stroke="var(--k-agent)" stroke-width="2.5"/><circle cx="22" cy="24" r="4" fill="var(--k-agent)"/><circle cx="44" cy="24" r="4" fill="var(--k-agent)"/><path d="M24 36h18" stroke="var(--k-agent)" stroke-width="3" stroke-linecap="round"/></g>
    <path d="M110 44h92M110 66h92" stroke="var(--f-api)" stroke-width="2.5" stroke-dasharray="7 5"/>
    <circle r="5" fill="var(--allow)"><animateMotion dur="2s" repeatCount="indefinite" path="M110 44h92"/></circle>
    <circle r="5" fill="var(--deny)"><animateMotion dur="2s" repeatCount="indefinite" path="M110 66h52"/></circle>
    <rect x="166" y="56" width="8" height="22" rx="2" fill="var(--deny)"/>
    <g transform="translate(212 24)"><rect width="74" height="62" rx="10" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/><path d="M14 18h46M14 31h46M14 44h30" stroke="var(--k-connector)" stroke-width="3" stroke-linecap="round"/></g></svg>`;
}
const ART_BG = { hr: "--c1", finance: "--c3", crm: "--c2", docs: "--c5", invoice: "--c6", tools: "--c4", lake: "--c7", model: "--c8" };
const ART_KINDS = { finance: ["source", "connector", "data-protection"], crm: ["actor", "source", "external"], docs: ["source", "governance-admin", "data-protection"], invoice: ["audit", "agent", "governance-admin"], model: ["agent", "external", "data-protection"] };
function cardArtGeneric(key) {
  const [a, b, c] = ART_KINDS[key] ?? ["actor", "agent", "source"];
  const tile = (x, kind) => { const k = KIND[kind]; return `<g transform="translate(${x} 24)"><rect x="5" y="5" width="62" height="62" rx="18" fill="var(--shadow)"/><rect width="62" height="62" rx="18" fill="var(--surface)" stroke="var(--outline)" stroke-width="3"/><g transform="translate(13 13) scale(1.8)"><path d="${k.d}" fill="none" stroke="var(${k.v})" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g></g>`; };
  return `<svg class="art" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="112" fill="color-mix(in srgb,var(${ART_BG[key] ?? "--c5"}) 45%,var(--surface))"/>
    <circle cx="290" cy="18" r="30" fill="#fff" opacity=".35"/><circle cx="20" cy="100" r="26" fill="#fff" opacity=".3"/>
    <path d="M106 56h36M190 56h36" stroke="var(--outline)" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/>
    <circle r="8" fill="var(--accent-2)" stroke="var(--outline)" stroke-width="2.5"><animateMotion dur="2.6s" repeatCount="indefinite" path="M104 56h40M188 56h36"/></circle>
    ${tile(40, a)}${tile(128, b)}${tile(220, c)}</svg>`;
}
function heroArt() {
  const star = (x, y, r, c) => `<path d="M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z" fill="${c}" stroke="var(--outline)" stroke-width="2" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 520 320" role="img" aria-label="Alice demande les salaires ; le contrôle d’accès arrête la requête">
    <circle cx="70" cy="60" r="46" fill="var(--c2)" opacity=".35"/><circle cx="470" cy="270" r="60" fill="var(--c1)" opacity=".28"/><circle cx="430" cy="50" r="28" fill="var(--c3)" opacity=".35"/>
    ${star(150, 46, 11, "var(--c2)")}${star(480, 150, 9, "var(--c1)")}${star(40, 260, 8, "var(--c3)")}
    <path d="M118 170C160 170 170 170 205 170" stroke="var(--outline)" stroke-width="3" stroke-dasharray="8 7" fill="none" stroke-linecap="round"/>
    <path d="M305 170C330 170 340 170 368 170" stroke="var(--outline)" stroke-width="3" stroke-dasharray="8 7" fill="none" stroke-linecap="round"/>
    <g>${faceG("alice-hero", 78, 170, 40)}</g>
    <g transform="translate(0 4)">${robotG(255, 166, 46)}</g>
    <g transform="translate(372 128)"><rect x="6" y="6" width="96" height="86" rx="20" fill="var(--shadow)"/><rect width="96" height="86" rx="20" fill="color-mix(in srgb,var(--c3) 40%,var(--surface))" stroke="var(--outline)" stroke-width="3"/>
      <g transform="translate(24 16) scale(2.4)"><path d="${KIND.source.d}" fill="none" stroke="var(--outline)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g></g>
    <circle r="11" fill="var(--deny)" stroke="var(--outline)" stroke-width="3"><animateMotion dur="2.4s" repeatCount="indefinite" path="M118 170H205M305 170H338"/></circle>
    <g transform="translate(342 140)"><path d="M14 0 28 6v13c0 11-6 19-14 23C6 38 0 30 0 19V6Z" fill="var(--c5)" stroke="var(--outline)" stroke-width="3" stroke-linejoin="round"/><path d="M8 20l5 5 9-10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${burstG(356, 104, "STOP !", "var(--deny)")}
    <g transform="translate(24 236)"><rect x="4" y="4" width="196" height="44" rx="16" fill="var(--shadow)"/><rect width="196" height="44" rx="16" fill="var(--surface)" stroke="var(--outline)" stroke-width="2.5"/><text x="16" y="28" font-family="Fredoka, Nunito, sans-serif" font-weight="600" font-size="15" fill="var(--ink)">« Les salaires stp ! »</text></g>
    <text x="300" y="300" font-size="13" font-weight="700" fill="var(--muted)" text-anchor="middle">Chaque décision cite sa source Microsoft Learn.</text></svg>`;
}
function heroNode(x, y, kind, label) {
  const k = KIND[kind];
  return `<g transform="translate(${x} ${y})"><rect width="100" height="50" rx="12" fill="var(--surface)" stroke="var(${k.v})" stroke-width="2"/><g transform="translate(10 15)">${`<path d="${k.d}" fill="none" stroke="var(${k.v})" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`}</g><text x="36" y="30" font-size="13" font-weight="700" fill="var(--ink)">${label}</text></g>`;
}

// ---------------------------------------------------------------- Galerie
const SOON = [];
function renderGallery() {
  const ms = allMissions(), got = ms.filter((m) => done.has(m.id)).length;
  const rules = SCENARIOS.reduce((n, e) => n + e.scenario.rules.length, 0);
  const presets = SCENARIOS.reduce((n, e) => n + e.scenario.presets.length, 0);
  $("#gallery").innerHTML = `
    <section class="hero"><div>
      <h1>Cassez <span class="pop">l’architecture.</span><br><mark>Puis sécurisez-la.</mark></h1>
      <p>Choisissez une demande client, suivez la requête brique par brique, changez une permission ou une politique — et regardez la décision basculer, preuve Microsoft Learn à l’appui.</p>
      <div class="stats"><div class="stat"><b>${SCENARIOS.length}</b><span>scénarios simulés</span></div><div class="stat"><b>${presets}</b><span>configurations guidées</span></div><div class="stat"><b>${rules}</b><span>règles sourcées</span></div><div class="stat"><b>${ms.length}</b><span>défis</span></div></div>
    </div><div class="hero-art">${heroArt()}</div></section>
    <div class="progress"><span>Défis relevés : <b>${got} / ${ms.length}</b></span><div class="track"><div class="fill" style="width:${ms.length ? (got / ms.length) * 100 : 0}%"></div></div></div>
    <div class="cards">${SCENARIOS.map((e) => {
      const s = e.scenario, n = s.missions.filter((m) => done.has(m.id)).length;
      return `<article class="card live" data-open="${s.id}" tabindex="0" role="link" aria-label="Explorer ${esc(s.title)}">${cardArt(e.meta.icon)}
        <h2>${esc(s.title)}</h2><q>${esc(s.customerRequest)}</q>
        <div class="chips">${e.meta.tech.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
        <div class="foot"><span class="risk">Difficulté <span class="diff-dots">${[1, 2, 3].map((i) => `<i class="${i <= e.meta.difficulty ? "on" : ""}"></i>`).join("")}</span> · défis ${n}/${s.missions.length}</span><button class="cta" type="button" tabindex="-1">Explorer l’architecture</button></div></article>`;
    }).join("")}</div>
    ${SOON.length ? `<h2 class="section-title">Bientôt dans le labo</h2><div class="soon-grid">${SOON.map(([t, d]) => `<div class="soon"><b>${esc(t)}</b>${esc(d)}</div>`).join("")}</div>` : ""}`;
  $("#gallery").querySelectorAll("[data-open]").forEach((c) => {
    const go = () => { location.hash = c.dataset.open; };
    c.addEventListener("click", go);
    c.addEventListener("keydown", (ev) => { if (ev.key === "Enter") go(); });
  });
}

// ---------------------------------------------------------------- Graphe
const NW = 180, NH = 64, COL = 214, ROW = 104, PAD = 40;
function layout(facts) {
  const vis = SC().nodes.filter((n) => !n.visibleWhen || evaluateCondition(n.visibleWhen, facts));
  const rows = new Map();
  vis.forEach((n) => { if (n.row === undefined) { const k = rows.get(n.layer) ?? 0; n.row = k; rows.set(n.layer, k + 1); } });
  const usedRows = [...new Set(vis.map((n) => n.row))].sort((a, b) => a - b);
  const rowIndex = (r) => usedRows.indexOf(r); // les rangées vides (brique masquée) se referment
  const pos = {};
  vis.forEach((n) => { pos[n.id] = { x: PAD + n.layer * COL, y: PAD + 20 + rowIndex(n.row) * ROW }; });
  const w = PAD * 2 + Math.max(...vis.map((n) => n.layer)) * COL + NW;
  const h = PAD * 2 + 20 + usedRows.length * ROW - (ROW - NH);
  const edges = SC().edges.filter((e) => pos[e.from] && pos[e.to] && (!e.visibleWhen || evaluateCondition(e.visibleWhen, facts)));
  return { vis, pos, edges, w, h };
}
function edgePath(a, b) {
  if (a.x === b.x) {
    const down = b.y > a.y, x = a.x + NW / 2, y1 = down ? a.y + NH : a.y, y2 = down ? b.y : b.y + NH;
    return { d: `M${x} ${y1}V${y2}`, lx: x + 6, ly: (y1 + y2) / 2 + 4, anchor: "start" };
  }
  const fwd = b.x > a.x, x1 = fwd ? a.x + NW : a.x, x2 = fwd ? b.x : b.x + NW, y1 = a.y + NH / 2, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
  return { d: `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, lx: mx, ly: (y1 + y2) / 2 - 7, anchor: "middle" };
}
function nodeStates() {
  const s = {};
  st.result.steps.forEach((step, i) => { if (i <= st.idx) step.nodeIds.forEach((n) => { s[n] = { d: step.decision, cur: i === st.idx }; }); });
  return s;
}
function edgeStates() {
  const s = {};
  st.result.steps.forEach((step, i) => { if (i <= st.idx && step.decision !== "not-applicable") step.edgeIds.forEach((e) => { s[e] = { d: step.decision, cur: i === st.idx }; }); });
  return s;
}
function renderGraph() {
  const Lg = layout(st.result.facts), svg = $("#graph");
  st.fit = { x: 0, y: 0, w: Lg.w, h: Lg.h };
  if (!st.vb) st.vb = { ...st.fit };
  const box = svg.getBoundingClientRect();
  if (st.follow && box.width && box.width < 640) {
    const step = st.idx >= 0 ? st.result.steps[st.idx] : null;
    const ids = (step ? step.nodeIds : SC().steps[0].nodeIds).filter((id) => Lg.pos[id]);
    if (ids.length) {
      const xs = ids.map((id) => Lg.pos[id].x), ys = ids.map((id) => Lg.pos[id].y);
      const cx = (Math.min(...xs) + Math.max(...xs) + NW) / 2, cy = (Math.min(...ys) + Math.max(...ys) + NH) / 2;
      const w = Math.max(Math.max(...xs) - Math.min(...xs) + NW + 50, 420), h = w * box.height / box.width;
      st.vb = { x: cx - w / 2, y: cy - h / 2, w, h };
    }
  }
  const ns = nodeStates(), es = edgeStates(), started = st.idx >= 0;
  const markers = FLOWS.map((f) => `<marker id="m-${f.k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(${f.v})"/></marker>`).join("");
  const edges = Lg.edges.filter((e) => st.flows.has(e.kind)).map((e) => {
    const f = FLOWS.find((x) => x.k === e.kind), p = edgePath(Lg.pos[e.from], Lg.pos[e.to]), s1 = es[e.id];
    return `<g class="edge${started && !s1 ? " dim" : ""}${s1?.cur ? " cur" : ""}">
      <path class="line" d="${p.d}" stroke="var(${f.v})" stroke-width="${e.kind === "governance" ? 1.6 : 2.6}" ${f.dash ? `stroke-dasharray="${f.dash}"` : ""} marker-end="url(#m-${f.k})"/>
      ${s1?.cur ? `<circle class="packet" r="8" fill="var(${DEC_VAR[s1.d]})" stroke="var(--outline)" stroke-width="2.5"><animateMotion dur="${(1.3 / st.speed).toFixed(2)}s" repeatCount="indefinite" path="${p.d}"/></circle>` : ""}
      <text x="${p.lx}" y="${p.ly}" text-anchor="${p.anchor}">${esc(e.label)}</text></g>`;
  }).join("");
  const nodes = Lg.vis.map((n) => {
    const p = Lg.pos[n.id], s = ns[n.id], sel = st.view?.type === "node" && st.view.id === n.id, k = KIND[n.kind] ?? KIND.actor;
    const col = s ? `var(${DEC_VAR[s.d]})` : "var(--shadow)";
    const label = n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label;
    const prod = n.product.length > 22 ? n.product.slice(0, 21) + "…" : n.product;
    const cx = p.x + 30, cy = p.y + NH / 2;
    const portrait = n.kind === "actor" ? faceG(n.id + SC().id, cx, cy, 19) : n.kind === "agent" ? robotG(cx, cy + 2, 18, s?.d === "deny" ? "worried" : "smile") : n.kind === "external" && SC().id !== "external-model" ? attackerG(cx, cy, 19)
      : `<circle cx="${cx}" cy="${cy}" r="19" fill="var(--surface)" stroke="var(--outline)" stroke-width="2"/><g transform="translate(${cx - 10} ${cy - 10})"><path d="${k.d}" fill="none" stroke="var(${k.v})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    const shadowOff = s?.cur ? 7 : 5;
    return `<g class="node${started && !s ? " dim" : ""}${s?.cur ? " cur" : ""}${s?.cur && s.d === "deny" ? " denied" : ""}" data-node="${n.id}" tabindex="0" role="button" aria-label="${esc(n.label)} — ${esc(n.product)}${s ? ", " + DEC[s.d] : ""}">
      <rect x="${p.x + shadowOff}" y="${p.y + shadowOff}" width="${NW}" height="${NH}" rx="18" fill="${col}"/>
      <rect class="box" x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="18" style="fill:color-mix(in srgb,var(${k.v}) 18%,var(--surface));stroke:${sel ? "var(--accent)" : "var(--outline)"};stroke-width:${sel ? 3.5 : 2.6}${n.necessity === "optional" ? ";stroke-dasharray:7 5" : ""}"/>
      ${portrait}
      <text class="lb" x="${p.x + 56}" y="${p.y + 28}">${esc(label)}</text>
      <text class="sub" x="${p.x + 56}" y="${p.y + 46}">${esc(prod)}</text>
      ${s ? `<circle cx="${p.x + NW - 2}" cy="${p.y + 2}" r="13" fill="${col}" stroke="var(--outline)" stroke-width="2.5"/><text x="${p.x + NW - 2}" y="${p.y + 7.5}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">${DEC_GLYPH[s.d]}</text>` : ""}
      ${s?.cur && s.d === "deny" ? burstG(p.x + NW / 2, p.y - 22, "STOP !", "var(--deny)") : ""}
      ${s?.cur && s.d === "indeterminate" ? burstG(p.x + NW / 2, p.y - 22, "?!", "var(--indet)") : ""}
    </g>`;
  }).join("");
  svg.innerHTML = `<defs>${markers}</defs>${edges}${nodes}`;
  applyViewBox();
  svg.querySelectorAll("[data-node]").forEach((g) => {
    const open = () => openNode(g.dataset.node);
    g.addEventListener("click", open);
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); } });
  });
}
function applyViewBox() { const v = st.vb; $("#graph").setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`); }

// ---------------------------------------------------------------- Parcours guidé : textes simples
const isMobile = () => matchMedia("(max-width:980px)").matches;
const scrollToEl = (sel, always) => { if (always || isMobile()) document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
const VERDICT = {
  ok: ["✅", "Ça passe, et c’est normal", "La demande est servie, dans les règles."],
  leak: ["🚨", "Fuite !", "Ça passe alors que ça ne devrait pas."],
  block: ["🛡️", "Bloqué : la sécurité fonctionne", "La demande non autorisée est arrêtée."],
  oops: ["😬", "Bloqué… à tort", "Une demande légitime est refusée : gênant pour le métier."],
  unknown: ["🤔", "Impossible de trancher", "La documentation ne permet pas de conclure."],
};
const SHORT = { ok: "✅ Ça passe", leak: "🚨 Fuite", block: "🛡️ Bloqué", oops: "😬 Bloqué à tort", unknown: "🤔 Indéterminé" };
function verdictKind(r) {
  if (r.outcome === "indeterminate") return "unknown";
  if (r.outcome === "obtained") return r.objective.met === false ? "leak" : "ok";
  return r.objective.met === false ? "oops" : "block";
}
const personaRole = (name) => SC().personas.find((p) => p.name === name)?.role ?? "";

// ---------------------------------------------------------------- Fil d'étapes
function renderStepper() {
  const cur = { ask: 0, run: 1, verdict: 2 }[st.phase];
  const items = [["ask", "La demande"], ["run", "Le trajet"], ["verdict", "Le verdict"], ["whatif", "Et si… ?"]];
  $("#stepper").innerHTML = items.map(([id, label], i) => {
    const on = i === cur || (st.phase === "verdict" && i === 3), isDone = i < cur, off = i >= 2 && st.phase !== "verdict";
    return `${i ? '<span class="arrow" aria-hidden="true">→</span>' : ""}<button type="button" data-goto="${id}" class="${on ? "on" : ""}${isDone ? " done" : ""}"${off ? " disabled" : ""}${on ? ' aria-current="step"' : ""}><span class="num">${isDone ? "✓" : i + 1}</span>${label}</button>`;
  }).join("");
  $("#stepper").querySelectorAll("[data-goto]").forEach((b) => b.onclick = () => {
    const g = b.dataset.goto;
    if (g === "ask") { stop(); st.phase = "ask"; st.idx = -1; st.view = null; renderAll(); scrollToEl("#ask", true); }
    else if (g === "run") launch();
    else { st.view = null; renderSide(); scrollToEl(g === "whatif" ? "#whatifs" : "#side", true); }
  });
}

// ---------------------------------------------------------------- 1. La demande
function renderAsk() {
  const r = st.result, first = r.story[0] ?? { label: "", text: "", actor: "user" };
  const role = personaRole(first.label);
  const q = SC().presets.find((p) => p.id === st.preset)?.question ?? "Configuration personnalisée (réglages avancés)";
  const btn = st.phase === "ask" ? `<button class="go" type="button" id="goBtn">▶ Lancer la demande</button>`
    : st.phase === "run" ? `<button class="go secondary" type="button" id="goBtn">${st.playing ? "⏸ Pause" : "▶ Reprendre"}</button><button class="go ghost" type="button" id="skipBtn">Aller au verdict ⏭</button>`
    : `<button class="go ghost" type="button" id="goBtn">↻ Revoir le trajet</button>`;
  $("#ask").innerHTML = `<div class="who">${avatarSvg(first.actor === "user" ? faceG(first.label, 20, 20, 18) : robotG(20, 21, 15), 58)}
      <div><div class="say">${esc(first.text)}</div><div class="ctx"><b>${esc(first.label)}</b>${role ? ", " + esc(role) : ""} · ${esc(q)}</div></div></div>
    <div class="acts">${btn}</div>`;
  $("#goBtn").onclick = () => (st.phase === "run" ? (st.playing ? stop() : resume()) : launch());
  const sk = $("#skipBtn"); if (sk) sk.onclick = () => { stop(); finish(); };
}

// ---------------------------------------------------------------- 2. Le trajet : narration et chronologie
function renderNarr() {
  const el = $("#narr"), n = st.result.steps.length;
  const bot = (mood) => `<span class="bot">${avatarSvg(robotG(20, 21, 15, mood), 46)}</span>`;
  if (st.idx < 0) {
    el.innerHTML = `${bot("smile")}<span class="t">Salut ! Appuie sur <b>Lancer la demande</b> : je te montre où passe la requête, et qui la laisse passer… ou pas.</span>`;
    return;
  }
  const s = st.result.steps[st.idx];
  const rank = { deny: 5, indeterminate: 4, conditional: 3, allow: 2, observed: 1, "not-applicable": 0 };
  const m = [...s.matched].sort((a, b) => rank[b.decision] - rank[a.decision])[0];
  const mood = s.decision === "deny" ? "worried" : s.decision === "indeterminate" ? "wow" : "smile";
  el.innerHTML = `${bot(mood)}<span class="n" style="background:var(${DEC_VAR[s.decision]});color:#fff;width:auto;padding:0 8px;border-radius:999px">${st.idx + 1}/${n}</span>
    <span class="t"><b>${esc(s.title)}</b> : ${esc(m ? m.rationale : s.skippedBecause ?? "")}</span>
    <span class="ctrl"><button type="button" id="nPrev" aria-label="Étape précédente"${st.idx <= 0 ? " disabled" : ""}>◀</button><button type="button" id="nNext" aria-label="Étape suivante"${st.idx >= n - 1 ? " disabled" : ""}>▶</button></span>`;
  $("#nPrev").onclick = () => { stop(); go(st.idx - 1); };
  $("#nNext").onclick = () => { stop(); go(st.idx + 1); };
}
function renderTimeline() {
  const r = st.result;
  $("#timeline").innerHTML = r.steps.map((s, i) => `<button type="button" class="tstep${i === st.idx ? " cur" : ""}${st.idx >= i ? " done" : ""}${st.idx >= 0 && i > st.idx ? " future" : ""}" data-step="${i}" style="--sc:var(${DEC_VAR[s.decision]});border-top-color:${st.idx >= i ? `var(${DEC_VAR[s.decision]})` : "var(--line)"}"><b>${i + 1}. ${esc(s.title)}</b><span>${st.idx >= i ? DEC_GLYPH[s.decision] + " " + DEC[s.decision] : "à venir"}</span></button>`).join("");
  $("#timeline").querySelectorAll("[data-step]").forEach((b) => b.onclick = () => {
    stop(); const i = Number(b.dataset.step);
    if (st.phase === "ask") st.phase = "run";
    st.idx = i; st.view = { type: "step", idx: i }; renderAll(); scrollToEl("#side");
  });
}

// ---------------------------------------------------------------- Panneau latéral
function backBtn() { return `<button type="button" class="go ghost back" id="backBtn">← ${st.phase === "verdict" ? "Retour au verdict" : "Retour"}</button>`; }
function renderSide() {
  const el = $("#side");
  if (st.view?.type === "node") el.innerHTML = `<div class="box">${backBtn()}${renderNode(st.view.id)}</div>`;
  else if (st.view?.type === "step") el.innerHTML = `<div class="box">${backBtn()}${renderStep(st.view.idx)}</div>`;
  else if (st.view === "missions") el.innerHTML = `<div class="box">${backBtn()}<h3>Défis</h3>${renderMissions()}</div>`;
  else if (st.phase === "ask") el.innerHTML = howToBox() + missionsTeaser();
  else if (st.phase === "run") el.innerHTML = `<div class="box"><h3>Ce qu’il faut regarder</h3><p style="margin:0;font-size:14px">Suis le point coloré : il part de <b>${esc(st.result.story[0]?.label ?? "l’utilisateur")}</b> et traverse les briques. Chaque brique reçoit une pastille : ✓ elle laisse passer, ✕ elle bloque.</p><p class="risk" style="margin:8px 0 0">Le verdict s’affiche ici à la fin du trajet. Touche une brique pour voir sa fiche.</p></div>` + (st.idx >= 0 ? `<div class="box">${renderStep(st.idx)}</div>` : "");
  else el.innerHTML = verdictCard() + storyBox() + whatIfBox() + missionsTeaser();
  const b = $("#backBtn"); if (b) b.onclick = () => { st.view = null; renderGraph(); renderSide(); el.scrollTop = 0; };
  el.querySelectorAll("[data-preset]").forEach((x) => x.onclick = () => applyPreset(x.dataset.preset));
  el.querySelectorAll("[data-open-step]").forEach((x) => x.onclick = () => { stop(); const i = Number(x.dataset.openStep); st.idx = i; st.view = { type: "step", idx: i }; renderAll(); });
  el.querySelectorAll("[data-open-missions]").forEach((x) => x.onclick = () => { st.view = "missions"; renderSide(); scrollToEl("#side"); });
  el.querySelectorAll("[data-open-drawer]").forEach((x) => x.onclick = openDrawer);
}
function howToBox() {
  return `<div class="box"><h3>Comment ça marche ?</h3><ol class="howto">
    <li><span class="num">1</span><span><b>Lis la demande</b> en haut : qui demande quoi.</span></li>
    <li><span class="num">2</span><span><b>Lance-la</b> et suis le point coloré à travers les briques Microsoft.</span></li>
    <li><span class="num">3</span><span><b>Lis le verdict</b> : ça passe, ça bloque, ou ça fuit, et qui a décidé.</span></li>
    <li><span class="num">4</span><span><b>Teste un « Et si… ? »</b> : un changement, et on compare avant / après.</span></li></ol>
    <div class="keys"><span class="badge d-allow">✓ passe</span><span class="badge d-deny">✕ bloque</span><span class="badge d-conditional">! sous condition</span><span class="badge d-indeterminate">? indéterminé</span></div></div>`;
}
function verdictCard() {
  const r = st.result, k = verdictKind(r), [ico, title, sub] = VERDICT[k];
  const all = r.steps.flatMap((s) => s.matched);
  const decisive = r.decisiveRuleId ? all.find((m) => m.ruleId === r.decisiveRuleId) : null;
  const weak = all.filter((m) => RR[m.risk] >= 3).sort((a, b) => RR[b.risk] - RR[a.risk])[0];
  const key = k === "leak" || k === "ok" ? weak : decisive ?? weak;
  const stepIdx = key ? r.steps.findIndex((s) => s.matched.some((m) => m.ruleId === key.ruleId)) : -1;
  const who = key ? `<div><div class="tag">${k === "leak" || k === "ok" ? "Le point faible" : "Qui a décidé ?"}</div><b>${esc(CTRL[key.controlKind])}</b> · ${esc(key.product)}<br>${esc(key.rationale)}<div class="risk" style="margin-top:4px">${refLink(key.ref)}</div>${stepIdx >= 0 ? `<button class="linkish" type="button" data-open-step="${stepIdx}">Voir l’étape ${stepIdx + 1} en détail</button>` : ""}</div>` : "";
  const cmp = st.before ? `<div class="compare"><span>Avant</span><span class="pill">${SHORT[verdictKind(st.before)]}</span><span>→ maintenant</span><span class="pill">${SHORT[k]}</span></div>${st.changedSteps.length ? `<div class="risk">Ce qui a changé : ${st.changedSteps.map((c) => `${esc(c.title)} (${DEC[c.before]} → ${DEC[c.after]})`).join(" · ")}</div>` : ""}` : "";
  const risks = r.residualRisks.length ? `<details><summary>Risques qui restent (${r.residualRisks.length})</summary><ul class="risk">${r.residualRisks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : "";
  return `<div class="box verdict-card v-${k}"><div class="vhead"><span class="big" aria-hidden="true">${ico}</span><div><b>${title}</b><span>${sub}</span></div></div>
    <div class="vbody">${cmp}<div>${esc(r.objective.explanation)}</div>${who}${risks}</div></div>`;
}
function storyBox() {
  const r = st.result, name = r.story[0]?.label ?? "l’utilisateur";
  const av = (it) => it.actor === "user" ? faceG(it.label, 20, 20, 18) : it.actor === "agent" ? robotG(20, 21, 15) : it.actor === "attacker" ? attackerG(20, 20, 18)
    : it.actor === "human" ? faceG("reviewer" + it.label, 20, 20, 18) : it.actor === "tool" ? `<circle cx="20" cy="20" r="18" fill="var(--c3)" stroke="var(--outline)" stroke-width="2"/><g transform="translate(10 10)"><path d="${KIND.connector.d}" fill="none" stroke="var(--outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
    : `<circle cx="20" cy="20" r="18" fill="${it.tone === "deny" ? "var(--deny)" : "var(--accent-2)"}" stroke="var(--outline)" stroke-width="2"/><text x="20" y="27" text-anchor="middle" font-size="19" font-weight="800" fill="${it.tone === "deny" ? "#fff" : "#1E1B3A"}">${it.tone === "deny" ? "✋" : "!"}</text>`;
  const bubbles = r.story.map((it) => `<div class="brow ${it.actor === "user" ? "mine" : it.actor === "human" ? "mid" : ""}">${avatarSvg(av(it), 38)}<div class="bub ${it.actor} t-${it.tone}"><small>${esc(it.label)}</small>${esc(it.text)}</div></div>`).join("");
  return `<div class="box"><h3>Ce que vit ${esc(name)}</h3><div class="story">${bubbles}</div>${r.table ? renderTable(r.table) : ""}</div>`;
}
function whatIfBox() {
  return `<div class="box" id="whatifs"><h3>Et si… ?</h3><p class="risk" style="margin:0 0 10px">Touche une question : la demande repart avec ce changement, puis le verdict compare avant et après.</p>
    <div class="whatifs">${SC().presets.map((p) => `<button type="button" class="whatif${p.id === st.preset ? " cur" : ""}" data-preset="${p.id}"${p.id === st.preset ? ' aria-current="true"' : ""}><span class="q">${esc(p.question ?? p.title)}</span><span class="go-ico" aria-hidden="true">${p.id === st.preset ? "●" : "▶"}</span></button>`).join("")}</div>
    <p style="margin:12px 0 0"><button class="linkish" type="button" data-open-drawer>⚙ Changer un réglage précis (avancé)</button></p></div>`;
}
function missionsTeaser() {
  const ms = SC().missions, n = ms.filter((m) => done.has(m.id)).length;
  return `<div class="box"><h3>🏆 Défis ${n}/${ms.length}</h3><p class="risk" style="margin:0 0 8px">Trouve toi-même la configuration qui réalise chaque défi.</p><button class="go ghost" type="button" data-open-missions>Voir les défis</button></div>`;
}
function renderMissions() {
  return `<p class="risk" style="margin-top:0">Utilise les « Et si… ? » ou les réglages avancés. Les défis relevés sont mémorisés dans ce navigateur.</p>` +
    SC().missions.map((m) => { const ok = done.has(m.id); return `<div class="mission${ok ? " done" : ""}"><span class="ck">${ok ? "✓" : ""}</span><div><b>${esc(m.title)}</b><p>${ok ? "Leçon : " + esc(m.lesson) : "Indice : " + esc(m.hint)}</p></div></div>`; }).join("") +
    `<button class="go secondary" type="button" data-open-drawer style="margin-top:6px">⚙ Ouvrir les réglages avancés</button>`;
}
function renderTable(t) {
  return `<h3 style="margin-top:16px">${esc(t.title)}</h3><div class="twrap"><table class="dtable"><tr>${t.columns.map((c) => `<th class="${c.sensitive ? "sens" : ""}">${esc(c.name)}</th>`).join("")}</tr>
    ${t.rows.map((row) => `<tr class="${row.visible ? "" : "rhid"}">${row.cells.map((cell, i) => {
      const c = t.columns[i], show = row.visible && c.visible;
      return `<td class="${show ? "ok" : "hid"}">${show ? esc(cell) : "████"}</td>`;
    }).join("")}</tr>`).join("")}</table></div>
    <p class="risk">${esc(t.note)} · <span style="color:var(--k-protect)">●</span> colonne sensible · hachures : non renvoyé.</p>`;
}
function renderNode(id) {
  const s = SC(), r = st.result, n = s.nodes.find((x) => x.id === id), d = n.details;
  const name = (x) => s.nodes.find((y) => y.id === x)?.label ?? x;
  const prev = [...new Set(s.edges.filter((e) => e.to === id).map((e) => e.from))].map(name);
  const next = [...new Set(s.edges.filter((e) => e.from === id).map((e) => e.to))].map(name);
  const touching = r.steps.filter((x) => x.nodeIds.includes(id) && x.matched.length);
  const list = (a) => a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "—";
  return `<div style="display:flex;gap:10px;align-items:center">${`<span style="display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:color-mix(in srgb,var(${(KIND[n.kind] ?? KIND.actor).v}) 14%,transparent)">${icon(n.kind, 22)}</span>`}<div><div class="title-lg">${esc(n.product)}</div><div class="risk">${esc(n.label)} · ${NEED[n.necessity]}</div></div></div>
    <dl class="dl"><dt>Pourquoi cette brique ?</dt><dd>${esc(d.why)}</dd><dt>Responsabilité</dt><dd>${esc(d.responsibility)}</dd>
    <dt>Données reçues</dt><dd>${list(d.inputs)}</dd><dt>Données transmises</dt><dd>${list(d.outputs)}</dd>
    <dt>Identités impliquées</dt><dd>${list(d.identities)}</dd><dt>Droits nécessaires</dt><dd>${list(d.rights)}</dd>
    <dt>Contrôles applicables</dt><dd>${list(d.controls)}</dd><dt>Limites à connaître</dt><dd>${list(d.limits)}</dd>
    <dt>Avant / après</dt><dd>${esc(prev.join(", ") || "—")} → <b>${esc(n.label)}</b> → ${esc(next.join(", ") || "—")}</dd>
    <dt>Prérequis et licences</dt><dd>${list(d.prerequisites)}</dd>
    <dt>Décisions dans cette simulation</dt><dd>${touching.length ? touching.map((x) => `${esc(x.title)} : ${badge(x.decision)}`).join("<br>") : "—"}</dd>
    <dt>Sources officielles</dt><dd>${d.refs.length ? `<ul>${d.refs.map((x) => `<li>${refLink(x)}</li>`).join("")}</ul>` : "—"}</dd></dl>`;
}
function renderStep(i) {
  const s = st.result.steps[i], def = SC().steps.find((x) => x.id === s.stepId);
  return `<div class="risk">Étape ${i + 1} sur ${st.result.steps.length}</div>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div class="title-lg">${esc(s.title)}</div>${badge(s.decision)}</div>
    <p class="risk" style="margin:4px 0 0">${esc(def.description)} · risque ${RISK[s.risk]}</p>
    ${s.skippedBecause ? `<div class="match">${esc(s.skippedBecause)}</div>` : ""}
    ${s.matched.map((m) => `<div class="match" style="border-left-color:var(${DEC_VAR[m.decision]})"><div class="hd"><b>${m.ruleId} · ${esc(CTRL[m.controlKind])}</b>${badge(m.decision)}</div>
      ${esc(m.rationale)}<div class="src">${esc(m.product)} · confiance ${CONF[m.confidence]} · <span class="risk ${m.risk}">risque ${RISK[m.risk]}</span><br>${refLink(m.ref)}</div></div>`).join("")}
    <p class="risk">Touchez une brique du graphe pour voir sa fiche.</p>`;
}

// ---------------------------------------------------------------- Réglages avancés (tiroir)
function openDrawer() { $("#drawer").hidden = false; renderDrawer(); $("#drawerClose").focus(); }
function closeDrawer() { $("#drawer").hidden = true; }
function renderDrawer() {
  const s = SC(), groups = [...new Set(s.parameters.map((p) => p.group))];
  $("#drawerBody").innerHTML = `<p class="risk" style="margin-top:0">Chaque changement recalcule immédiatement le verdict, comparé à la situation précédente.</p>
    ${groups.map((g) => `<div class="grp">${esc(g)}</div>` + s.parameters.filter((p) => p.group === g).map((p) => `<div class="field"><label for="p-${p.id}">${esc(p.label)}</label>
      <select id="p-${p.id}" data-param="${p.id}">${p.options.map((o) => `<option value="${o.value}"${st.params[p.id] === o.value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>`).join("")).join("")}
    <h3>Affichage</h3>
    <div class="field"><label>Vitesse de l’animation</label><span class="seg" role="group" aria-label="Vitesse">${[["0.5", "Lente"], ["1", "Normale"], ["2", "Rapide"]].map(([v, l]) => `<button type="button" data-speed="${v}" aria-pressed="${Number(v) === st.speed}">${l}</button>`).join("")}</span></div>
    <div class="field"><label>Types de flux affichés</label>${FLOWS.map((f) => `<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--ink)"><input type="checkbox" data-flow="${f.k}"${st.flows.has(f.k) ? " checked" : ""}><svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" stroke="var(${f.v})" stroke-width="2.5" ${f.dash ? `stroke-dasharray="${f.dash}"` : ""}/></svg>${f.label}</label>`).join("")}</div>
    <h3>Acteurs</h3><table class="mini"><tr><th>Personne</th><th>Rôle</th></tr>${s.personas.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.role)}</td></tr>`).join("")}</table>
    <h3>Données</h3><table class="mini"><tr><th>Élément</th><th>Sensibilité</th></tr>${s.documents.map((d) => `<tr><td>${esc(d.title)}<br><span class="risk">${esc(d.library)}</span></td><td>${esc(d.label)}</td></tr>`).join("")}</table>
    <details><summary>Règles de sécurité (${s.rules.length})</summary>${s.rules.map((r) => `<div class="rule-li"><b>${r.id}</b> v${r.version} · ${esc(r.description)} <span class="risk">confiance ${CONF[r.confidence]}</span></div>`).join("")}</details>
    <p class="risk">Contexte : ${esc(s.businessContext)}</p>`;
  $("#drawerBody").querySelectorAll("[data-param]").forEach((el) => el.onchange = () => setParams({ ...st.params, [el.dataset.param]: el.value }, null, false));
  $("#drawerBody").querySelectorAll("[data-speed]").forEach((b) => b.onclick = () => { st.speed = Number(b.dataset.speed); renderDrawer(); renderGraph(); });
  $("#drawerBody").querySelectorAll("[data-flow]").forEach((c) => c.onchange = () => { c.checked ? st.flows.add(c.dataset.flow) : st.flows.delete(c.dataset.flow); renderGraph(); });
}

// ---------------------------------------------------------------- Défis : récompense
function award() {
  if (st.phase !== "verdict") return;
  const fresh = SC().missions.filter((m) => !done.has(m.id) && missionAchieved(st.result, m));
  if (!fresh.length) return;
  fresh.forEach((m) => done.add(m.id)); saveDone();
  const m = fresh[0], t = $("#toast");
  t.innerHTML = `<b>Défi relevé !</b><p>${esc(m.title)}</p><p class="risk">${esc(m.lesson)}</p>`;
  t.classList.add("on"); clearTimeout(award.t); award.t = setTimeout(() => t.classList.remove("on"), 5200);
  const c = $("#confetti"), colors = ["--allow", "--accent", "--cond", "--k-protect", "--k-agent"];
  c.innerHTML = Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:var(${colors[i % colors.length]});animation-delay:${(i % 9) * 0.06}s"></i>`).join("");
  setTimeout(() => { c.innerHTML = ""; }, 2200);
  renderHead(); renderSide();
}

// ---------------------------------------------------------------- Déroulé
function renderAll() { renderStepper(); renderAsk(); renderGraph(); renderNarr(); renderTimeline(); renderSide(); }
function go(i) {
  st.idx = Math.max(-1, Math.min(i, last()));
  if (st.view?.type === "step") st.view = { type: "step", idx: Math.max(0, st.idx) };
  if (st.idx >= last() && st.phase === "run") { finish(); return; }
  renderStepper(); renderAsk(); renderGraph(); renderNarr(); renderTimeline(); renderSide();
}
function stop() { st.playing = false; clearTimeout(st.timer); if (st.result && st.phase === "run") renderAsk(); }
function tick() {
  if (!st.playing) return;
  if (st.idx >= last()) { finish(); return; }
  go(st.idx + 1);
  if (st.playing && st.phase === "run") st.timer = setTimeout(tick, 1700 / st.speed);
}
function resume() { st.playing = true; renderAsk(); st.timer = setTimeout(tick, 300); }
function launch() {
  clearTimeout(st.timer);
  st.phase = "run"; st.idx = -1; st.view = null; st.playing = true; st.follow = true; st.vb = null;
  renderAll(); scrollToEl("#graphCard");
  st.timer = setTimeout(tick, 500);
}
function finish() {
  st.playing = false; clearTimeout(st.timer);
  st.phase = "verdict"; st.idx = last(); st.view = null;
  renderAll(); $("#side").scrollTop = 0; award(); scrollToEl("#side");
}
function setParams(next, presetId, animate) {
  stop();
  st.before = st.result; st.params = next; st.preset = presetId; st.result = run(next);
  st.changedSteps = diffResults(st.before, st.result, SC().outcomeLabels ?? {}).changedSteps;
  st.view = null; st.vb = null; st.follow = true;
  if (animate) launch(); else { st.phase = "verdict"; st.idx = last(); renderAll(); $("#side").scrollTop = 0; award(); }
}
function applyPreset(id) {
  const p = SC().presets.find((x) => x.id === id);
  if (!p) return;
  setParams(resolveParams(SC(), p.params), p.id, true);
}
function openNode(id) { st.view = { type: "node", id }; renderGraph(); renderSide(); $("#side").scrollTop = 0; scrollToEl("#side"); }
function renderHead() {
  const e = st.entry, s = e.scenario, n = s.missions.filter((m) => done.has(m.id)).length;
  $("#scenHead").innerHTML = `<span style="display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--surface-2);border:2.5px solid var(--outline)">${icon({ hr: "data-protection", lake: "source", tools: "agent", finance: "source", crm: "actor", docs: "data-protection", invoice: "audit", model: "external" }[e.meta.icon] ?? "agent", 20)}</span>
    <h1>${esc(s.title)}</h1><q>${esc(s.customerRequest)}</q>
    <span class="acts"><button class="tb" type="button" id="hMissions">🏆 Défis ${n}/${s.missions.length}</button><button class="tb" type="button" id="hDrawer">⚙ Réglages avancés</button></span>`;
  $("#hMissions").onclick = () => { st.view = "missions"; renderSide(); scrollToEl("#side"); };
  $("#hDrawer").onclick = openDrawer;
}
function openScenario(id) {
  const e = SCENARIOS.find((x) => x.scenario.id === id);
  if (!e) { location.hash = ""; return; }
  if (st.entry !== e) {
    st.entry = e; st.preset = e.scenario.presets[0].id;
    st.params = resolveParams(e.scenario, e.scenario.presets[0].params);
    st.result = run(st.params); st.before = null; st.changedSteps = []; st.idx = -1; st.phase = "ask"; st.view = null; st.vb = null; st.follow = true;
  }
  renderHead(); renderAll();
}

// ---------------------------------------------------------------- Zoom, déplacement, plein écran
function zoom(f, cx, cy) {
  st.follow = false;
  const v = st.vb; cx ??= v.x + v.w / 2; cy ??= v.y + v.h / 2;
  const w = Math.min(Math.max(v.w * f, st.fit.w * 0.2), st.fit.w * 3), k = w / v.w;
  st.vb = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w, h: v.h * k }; applyViewBox();
}
function bindGraphGestures() {
  const svg = $("#graph");
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect(), v = st.vb, s = Math.max(v.w / r.width, v.h / r.height);
    zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, v.x + (e.clientX - r.left) * s, v.y + (e.clientY - r.top) * s);
  }, { passive: false });
  let drag = null;
  svg.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-node]")) return; drag = { x: e.clientX, y: e.clientY, vb: { ...st.vb } }; st.follow = false; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = svg.getBoundingClientRect(), s = Math.max(drag.vb.w / r.width, drag.vb.h / r.height);
    st.vb = { ...drag.vb, x: drag.vb.x - (e.clientX - drag.x) * s, y: drag.vb.y - (e.clientY - drag.y) * s }; applyViewBox();
  });
  svg.addEventListener("pointerup", () => { drag = null; });
  $("#zin").onclick = () => zoom(1 / 1.25);
  $("#zout").onclick = () => zoom(1.25);
  $("#zfit").onclick = () => { st.follow = true; st.vb = { ...st.fit }; renderGraph(); };
  $("#zfull").onclick = () => { const w = $("#graphWrap"); if (document.fullscreenElement) document.exitFullscreen?.(); else w.requestFullscreen?.().catch(() => {}); };
}

// ---------------------------------------------------------------- Navigation et thème
function route() {
  const id = location.hash.slice(1), onCanvas = SCENARIOS.some((e) => e.scenario.id === id);
  $("#gallery").hidden = onCanvas; $("#canvasView").hidden = !onCanvas;
  stop(); closeDrawer();
  if (onCanvas) openScenario(id); else renderGallery();
  scrollTo(0, 0);
}
function init() {
  $("#legend").innerHTML = `<span><b>Pastilles :</b></span>` + Object.keys(DEC).map((d) => `<span><i style="background:var(${DEC_VAR[d]})"></i>${DEC_GLYPH[d]} ${DEC[d]}</span>`).join("");
  $("#home").onclick = () => { location.hash = ""; };
  $("#drawerClose").onclick = closeDrawer;
  $("#drawer").addEventListener("click", (e) => { if (e.target.id === "drawer") closeDrawer(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer(); });
  $("#theme").onclick = () => {
    const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
  };
  bindGraphGestures();
  addEventListener("hashchange", route);
  route();
}
init();
})();
