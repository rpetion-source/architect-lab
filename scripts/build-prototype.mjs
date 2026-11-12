// Compile le noyau TypeScript et l'injecte dans le prototype HTML autonome.
// Chaque module est enveloppé dans sa propre portée ; les imports relatifs sont résolus entre modules.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { posix } from "node:path";

const out = ".build";
rmSync(out, { recursive: true, force: true });
execSync(`tsc -p tsconfig.json --noEmit false --outDir ${out} --rewriteRelativeImportExtensions`, { stdio: "inherit" });

const order = [
  "data/sources.js", "lib/policy-engine/engine.js",
  "data/scenarios/hr-sharepoint/scenario.js", "data/scenarios/hr-sharepoint/facts.js",
  "data/scenarios/fabric-rls/scenario.js", "data/scenarios/fabric-rls/facts.js",
  "data/scenarios/foundry-mcp/scenario.js", "data/scenarios/foundry-mcp/facts.js",
  "data/scenarios/_kit.js",
  "data/scenarios/finance-d365/index.js", "data/scenarios/sales-dataverse/index.js", "data/scenarios/docs-sharepoint/index.js",
  "data/scenarios/invoices/index.js", "data/scenarios/external-model/index.js",
  "data/scenarios/registry.js",
];
const key = (f) => "__m_" + f.replace(/[^a-zA-Z0-9]/g, "_");
const modules = order.map((f) => {
  let src = readFileSync(`${out}/${f}`, "utf8");
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*"([^"]+)";?$/gm, (_, names, from) => {
    const target = posix.normalize(posix.join(posix.dirname(f), from));
    if (!order.includes(target)) throw new Error(`Import non résolu : ${from} dans ${f}`);
    const list = names.split(",").map((n) => n.trim()).filter(Boolean).join(", ");
    return list ? `const { ${list} } = ${key(target)};` : "";
  });
  if (/^import /m.test(src)) throw new Error(`Import restant dans ${f}`);
  const exported = [...src.matchAll(/^export (?:const|function|let|class) (\w+)/gm)].map((m) => m[1]);
  const reexports = [...src.matchAll(/^export \{([^}]*)\};?$/gm)].flatMap((m) => m[1].split(",").map((n) => n.trim()).filter(Boolean));
  src = src.replace(/^export \{[^}]*\};?$/gm, "").replace(/^export (const|function|let|class)/gm, "$1");
  return `const ${key(f)} = (() => {\n${src}\nreturn { ${[...exported, ...reexports].join(", ")} };\n})();`;
});
const engine = `(() => {\n${modules.join("\n")}\nconst api = { ...${key("lib/policy-engine/engine.js")}, ...${key("data/scenarios/registry.js")} };\nglobalThis.Lab = api;\n})();`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/engine.bundle.js", engine);
const html = readFileSync("prototype/template.html", "utf8")
  .replace("/*__ENGINE__*/", () => engine)
  .replace("/*__UI__*/", () => readFileSync("prototype/ui.js", "utf8"));
writeFileSync("dist/index.html", html);
rmSync(out, { recursive: true, force: true });
console.log(`dist/index.html — ${(html.length / 1024).toFixed(1)} Ko`);
