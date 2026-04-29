import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/commands/warmup.ts
init_esm_shims();
async function runWarmup(opts = {}) {
  const stderr = opts.stderr ?? ((m) => process.stderr.write(m));
  let embedder = opts.embedder;
  if (!embedder) {
    const { XenovaRuleEmbedder } = await import("./src-WFKRPSJT.js");
    embedder = new XenovaRuleEmbedder();
  }
  const start = Date.now();
  stderr("\u23F3 TeamAgent: \u9884\u70ED\u5411\u91CF\u6A21\u578B multilingual-e5-small (~120MB)...\n");
  try {
    await embedder.embed(["warmup"]);
    const durationMs = Date.now() - start;
    stderr(`\u2705 TeamAgent: \u6A21\u578B\u9884\u70ED\u5B8C\u6210 (${durationMs}ms)
`);
    return { ok: true, durationMs };
  } catch (e) {
    const error = e.message ?? String(e);
    stderr(`\u26A0\uFE0F  TeamAgent: \u6A21\u578B\u9884\u70ED\u5931\u8D25 (${error})
`);
    stderr("   \u4E0D\u5F71\u54CD\u5B89\u88C5\uFF1B\u9996\u6B21\u4F7F\u7528\u65F6\u4ECD\u4F1A\u6309\u9700\u4E0B\u8F7D\u3002\n");
    return { ok: false, durationMs: Date.now() - start, error };
  }
}
export {
  runWarmup
};
