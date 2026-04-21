#!/usr/bin/env node
import { runWikiRefresh, logErrors } from "./wiki-refresh.js";
import { InMemoryAttributionBus, StdoutRenderer } from "@teamagent/adapters";
import { parseVisibilityMode } from "@teamagent/types";

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const cwd = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
  const bus = new InMemoryAttributionBus();

  const result = await runWikiRefresh({ cwd, force, bus });
  await logErrors(result.errors);

  const events = bus.drain();
  const mode = parseVisibilityMode(process.env["TEAMAGENT_VISIBILITY"]);
  const renderer = new StdoutRenderer();
  const output = renderer.render(events, mode);
  if (output) {
    process.stdout.write(output + "\n");
  }
}

main().catch(() => process.exit(0));
