#!/usr/bin/env node
import { runWikiRefresh, logErrors } from "./wiki-refresh.js";

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const cwd = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
  const result = await runWikiRefresh({ cwd, force });

  if (result.skipped) {
    process.stdout.write(`wiki:refresh skipped (${result.skipReason})\n`);
  } else {
    process.stdout.write(
      `wiki:refresh done — added: ${result.added}, archived: ${result.archived}, errors: ${result.errors.length}\n`,
    );
  }
  await logErrors(result.errors);
}

main().catch(() => process.exit(0));
