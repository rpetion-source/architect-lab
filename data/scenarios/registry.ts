import type { ParamValues, ScenarioDef, SimulationResult } from "../../lib/types/index.ts";
import { simulate, type FactDeriver, type OutcomeSummarizer } from "../../lib/policy-engine/engine.ts";
import { hrSharePointScenario } from "./hr-sharepoint/scenario.ts";
import { deriveHrFacts, summarizeHr } from "./hr-sharepoint/facts.ts";
import { fabricScenario } from "./fabric-rls/scenario.ts";
import { deriveFabricFacts, summarizeFabric } from "./fabric-rls/facts.ts";
import { foundryMcpScenario } from "./foundry-mcp/scenario.ts";
import { deriveMcpFacts, summarizeMcp } from "./foundry-mcp/facts.ts";
import { financeScenario, deriveFinance, summarizeFinance } from "./finance-d365/index.ts";
import { salesScenario, deriveSales, summarizeSales } from "./sales-dataverse/index.ts";
import { docsScenario, deriveDocs, summarizeDocs } from "./docs-sharepoint/index.ts";
import { invoiceScenario, deriveInvoices, summarizeInvoices } from "./invoices/index.ts";
import { externalModelScenario, deriveExternal, summarizeExternal } from "./external-model/index.ts";

export type ScenarioIcon = "hr" | "lake" | "tools" | "finance" | "crm" | "docs" | "invoice" | "model";

export interface ScenarioEntry {
  scenario: ScenarioDef;
  derive: FactDeriver;
  summarize: OutcomeSummarizer;
  meta: { icon: ScenarioIcon; tech: string[]; difficulty: 1 | 2 | 3 };
}

// Ordre du cahier des charges (scénarios 1 à 8).
export const SCENARIOS: ScenarioEntry[] = [
  { scenario: hrSharePointScenario, derive: deriveHrFacts, summarize: summarizeHr, meta: { icon: "hr", tech: ["Copilot Studio", "SharePoint", "Entra ID", "Purview", "Power Platform"], difficulty: 1 } },
  { scenario: financeScenario, derive: deriveFinance, summarize: summarizeFinance, meta: { icon: "finance", tech: ["D365 F&O", "Link to Fabric", "OneLake security", "Copilot Studio"], difficulty: 3 } },
  { scenario: salesScenario, derive: deriveSales, summarize: summarizeSales, meta: { icon: "crm", tech: ["Copilot Studio", "Dataverse", "Power Platform"], difficulty: 2 } },
  { scenario: docsScenario, derive: deriveDocs, summarize: summarizeDocs, meta: { icon: "docs", tech: ["Microsoft 365 Copilot", "SharePoint Advanced Management", "Purview DLP"], difficulty: 1 } },
  { scenario: invoiceScenario, derive: deriveInvoices, summarize: summarizeInvoices, meta: { icon: "invoice", tech: ["Copilot Studio", "Flux d'agent", "Human in the loop"], difficulty: 2 } },
  { scenario: foundryMcpScenario, derive: deriveMcpFacts, summarize: summarizeMcp, meta: { icon: "tools", tech: ["Foundry Agent Service", "MCP", "Guardrails"], difficulty: 3 } },
  { scenario: fabricScenario, derive: deriveFabricFacts, summarize: summarizeFabric, meta: { icon: "lake", tech: ["Fabric", "OneLake security", "Entra ID"], difficulty: 2 } },
  { scenario: externalModelScenario, derive: deriveExternal, summarize: summarizeExternal, meta: { icon: "model", tech: ["Microsoft Foundry", "Claude", "GPT", "Purview Endpoint DLP"], difficulty: 2 } },
];

export function runScenario(id: string, params: Partial<ParamValues> = {}): SimulationResult {
  const e = SCENARIOS.find((s) => s.scenario.id === id);
  if (!e) throw new Error(`Scénario inconnu : ${id}`);
  return simulate(e.scenario, params, e.derive, e.summarize);
}
