import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { SCENARIOS, runScenario } from "../data/scenarios/registry.ts";

test("le prototype embarque le même moteur : résultats identiques pour chaque préréglage de chaque scénario", () => {
  const ctx: Record<string, any> = {};
  vm.runInNewContext(readFileSync("dist/engine.bundle.js", "utf8"), ctx);
  const L = ctx.Lab;
  for (const { scenario } of SCENARIOS) {
    for (const p of scenario.presets) {
      const a = L.runScenario(scenario.id, p.params);
      assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(runScenario(scenario.id, p.params))), `${scenario.id}/${p.id}`);
    }
  }
});
