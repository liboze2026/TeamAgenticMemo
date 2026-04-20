import { defineConfig } from "tsup";

const ENTRIES = {
  bin:                      "../cli/src/bin.ts",
  "bin-pre-tool-use":       "../cli/src/bin-pre-tool-use.ts",
  "bin-post-tool-use":      "../cli/src/bin-post-tool-use.ts",
  "bin-stop":               "../cli/src/bin-stop.ts",
  "bin-user-prompt-submit": "../cli/src/bin-user-prompt-submit.ts",
};

const NATIVE_EXTERNAL = ["sharp", "onnxruntime-node", "jsdom", "sqlite-vec", "better-sqlite3"];

export default defineConfig([
  {
    entry: { bin: ENTRIES.bin },
    format: ["esm"],
    platform: "node",
    target: "node22",
    outDir: "dist",
    bundle: true,
    splitting: false,
    noExternal: [
      "@teamagent/types",
      "@teamagent/ports",
      "@teamagent/core",
      "@teamagent/adapters",
      "@teamagent/cli",
      "zod",
    ],
    external: NATIVE_EXTERNAL,
    shims: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: {
      "bin-pre-tool-use":       ENTRIES["bin-pre-tool-use"],
      "bin-post-tool-use":      ENTRIES["bin-post-tool-use"],
      "bin-stop":               ENTRIES["bin-stop"],
      "bin-user-prompt-submit": ENTRIES["bin-user-prompt-submit"],
    },
    format: ["cjs"],
    platform: "node",
    target: "node22",
    outDir: "dist",
    bundle: true,
    splitting: false,
    noExternal: [
      "@teamagent/types",
      "@teamagent/ports",
      "@teamagent/core",
      "@teamagent/adapters",
      "@teamagent/cli",
      "zod",
      "@xenova/transformers",
    ],
    external: NATIVE_EXTERNAL,
    shims: true,
  },
]);
