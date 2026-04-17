import type { CompiledTask, GroupConfig, TaskResult } from "./types.js";
import type { SdkRunner } from "./sdk-runner.js";
import { evaluatePatterns } from "./evaluator.js";
import { scanWorkdirSources } from "./workdir-scanner.js";

export async function runTask(
  task: CompiledTask,
  group: GroupConfig,
  sdk: SdkRunner,
  workdir: string,
  run: number,
): Promise<TaskResult> {
  const start = Date.now();
  try {
    const sdkResult = await sdk.run(task.prompt, workdir);
    const durationMs = Date.now() - start;
    const workdirSources = await scanWorkdirSources(workdir);
    const combined = sdkResult.output + (workdirSources ? `\n${workdirSources}` : "");

    if (combined === "") {
      return {
        group: group.name,
        taskId: task.id,
        run,
        verdict: "neither",
        reason: "empty_response",
        tokensIn: sdkResult.tokensIn,
        tokensOut: sdkResult.tokensOut,
        durationMs,
        output: "",
      };
    }

    const { verdict, reason } = evaluatePatterns(combined, task);
    return {
      group: group.name,
      taskId: task.id,
      run,
      verdict,
      reason,
      tokensIn: sdkResult.tokensIn,
      tokensOut: sdkResult.tokensOut,
      durationMs,
      output: combined,
    };
  } catch (e) {
    return {
      group: group.name,
      taskId: task.id,
      run,
      verdict: "error",
      reason: "sdk_error",
      tokensIn: 0,
      tokensOut: 0,
      durationMs: Date.now() - start,
      output: "",
      errorMsg: e instanceof Error ? e.message : String(e),
    };
  }
}
