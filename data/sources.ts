import type { SourceRef } from "../lib/types/index.ts";

// Pages ouvertes et lues le 2026-11-11. "Unstated" = la page ne précise pas GA/Preview.
export const REF = {
  cpsDataPolicies: {
    title: "Configure data policies for agents (Copilot Studio)",
    url: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/admin-data-loss-prevention",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  cpsSharePointKnowledge: {
    title: "Add SharePoint as a knowledge source (Copilot Studio)",
    url: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-add-sharepoint",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  purviewCopilotStudio: {
    title: "Use Microsoft Purview to manage data security & compliance for Microsoft Copilot Studio",
    url: "https://learn.microsoft.com/en-us/purview/ai-copilot-studio",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  cpsMakerCredentials: {
    title: "Control maker-provided credentials (Copilot Studio)",
    url: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/configure-no-maker-authentication",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  cpsConnectors: {
    title: "Use Power Platform connectors as tools (Copilot Studio)",
    url: "https://learn.microsoft.com/microsoft-copilot-studio/advanced-connectors",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  cpsSensitivityLabels: {
    title: "Sensitivity labels in Copilot Studio",
    url: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/sensitivity-label-copilot-studio",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  cpsSharePointTroubleshoot: {
    title: "SharePoint knowledge sources don't return results",
    url: "https://learn.microsoft.com/en-us/troubleshoot/power-platform/copilot-studio/knowledge/sharepoint-no-response",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  ppEndpointFiltering: {
    title: "Connector endpoint filtering (Power Platform)",
    url: "https://learn.microsoft.com/en-us/power-platform/admin/connector-endpoint-filtering",
    verifiedOn: "2026-11-11", status: "Unverified",
  },
  purviewAuditCopilot: {
    title: "Audit logs for Copilot and AI activities",
    url: "https://learn.microsoft.com/en-us/purview/audit-copilot",
    verifiedOn: "2026-11-11", status: "Unverified",
  },
  purviewServiceDescription: {
    title: "Microsoft Purview service description (licences)",
    url: "https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description",
    verifiedOn: "2026-11-11", status: "Unverified",
  },
  cpsEndUserAuth: {
    title: "Configure user authentication in Copilot Studio",
    url: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/configuration-end-user-authentication",
    verifiedOn: "2026-11-11", status: "Unverified",
  },
  fabricSecurityOverview: {
    title: "Data security in OneLake (Fabric)",
    url: "https://learn.microsoft.com/en-us/fabric/onelake/security/get-started-security",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  fabricRlsCls: {
    title: "Table, column, and row-level security in OneLake",
    url: "https://learn.microsoft.com/en-us/fabric/onelake/security/table-column-row-security",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  fabricAuthorizedEngines: {
    title: "OneLake security integrations (authorized engines)",
    url: "https://learn.microsoft.com/en-us/fabric/onelake/security/onelake-security-integrations-overview",
    verifiedOn: "2026-11-11", status: "Preview",
  },
  foundryMcp: {
    title: "Connect agents to Model Context Protocol servers (Foundry Agent Service)",
    url: "https://learn.microsoft.com/azure/foundry/agents/how-to/tools/model-context-protocol",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  foundryGuardrails: {
    title: "Guardrails overview (Microsoft Foundry)",
    url: "https://learn.microsoft.com/azure/ai-foundry/guardrails/guardrails-overview",
    verifiedOn: "2026-11-11", status: "Preview",
  },
  foundryInterventionPoints: {
    title: "Guardrail intervention points (Microsoft Foundry)",
    url: "https://learn.microsoft.com/azure/foundry/guardrails/intervention-points",
    verifiedOn: "2026-11-11", status: "Preview",
  },
  promptShields: {
    title: "Prompt Shields in Microsoft Foundry",
    url: "https://learn.microsoft.com/azure/ai-services/openai/concepts/content-filter-prompt-shields",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  dataverseKnowledge: {
    title: "Knowledge in Microsoft Copilot Studio (blog Power Platform)",
    url: "https://www.microsoft.com/en-us/power-platform/blog/2025/03/27/knowledge-in-microsoft-copilot-studio/",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  linkToFabric: {
    title: "Link your Dataverse environment to Microsoft Fabric",
    url: "https://learn.microsoft.com/power-apps/maker/data-platform/azure-synapse-link-view-in-fabric",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  fabricLinkTroubleshoot: {
    title: "Troubleshoot Link to Microsoft Fabric",
    url: "https://learn.microsoft.com/en-us/power-apps/maker/data-platform/fabric-troubleshoot",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  rcd: {
    title: "Restrict discovery of SharePoint sites and content",
    url: "https://learn.microsoft.com/en-us/sharepoint/restricted-content-discovery",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  hitl: {
    title: "Human in the loop connector (approvals)",
    url: "https://learn.microsoft.com/en-us/connectors/advancedapprovals/",
    verifiedOn: "2026-11-11", status: "Preview",
  },
  agentFlows: {
    title: "Introducing agent flows (Copilot Studio blog)",
    url: "https://www.microsoft.com/en-us/copilot/blog/copilot-studio/introducing-agent-flows-transforming-automation-with-ai-first-workflows/",
    verifiedOn: "2026-11-11", status: "GA",
  },
  azureDirectPrivacy: {
    title: "Data, privacy, and security for Azure Direct Models in Microsoft Foundry",
    url: "https://learn.microsoft.com/legal/cognitive-services/openai/data-privacy",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  claudePrivacy: {
    title: "Data, privacy, and security for Claude models in Microsoft Foundry",
    url: "https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/claude-models/data-privacy",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
  claudeHosting: {
    title: "Claude models hosting comparison (Microsoft Foundry)",
    url: "https://learn.microsoft.com/azure/foundry/foundry-models/concepts/claude-models-hosting-comparison",
    verifiedOn: "2026-11-11", status: "Unstated",
  },
} satisfies Record<string, SourceRef>;
