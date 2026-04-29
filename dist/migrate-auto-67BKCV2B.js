import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/commands/migrate-auto.ts
init_esm_shims();
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
var STEPS = ["migrate-v6", "migrate-v7"];
async function runMigrateAuto(opts = {}) {
  const binJs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "bin.js");
  const runStep = opts.runStep ?? defaultRunStep;
  const steps = [];
  for (const cmd of STEPS) {
    const code = await runStep(binJs, cmd);
    steps.push({ cmd, code });
    if (code !== 0) {
      return { ok: false, steps, error: `step ${cmd} exit ${code}` };
    }
  }
  return { ok: true, steps };
}
function defaultRunStep(binJs, cmd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [binJs, cmd], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}
export {
  runMigrateAuto
};
