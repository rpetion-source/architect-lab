import type { ParamValues, SimulationResult } from "../../../lib/types/index.ts";
import { simulate } from "../../../lib/policy-engine/engine.ts";
import { hrSharePointScenario } from "./scenario.ts";
import { deriveHrFacts, summarizeHr } from "./facts.ts";

export { hrSharePointScenario, deriveHrFacts, summarizeHr };

export function simulateHr(params: Partial<ParamValues> = {}): SimulationResult {
  return simulate(hrSharePointScenario, params, deriveHrFacts, summarizeHr);
}
