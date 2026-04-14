import { describe, it, expect } from "vitest";
import {
  runLLMClientContract,
  type LLMBehavior,
} from "@teamagent/ports/contracts";
import {
  ClaudeCodeLLMClient,
  parseClaudeJsonOutput,
  type Spawner,
  type SpawnResult,
} from "../claude-code-client.js";
import { LLMClientError } from "@teamagent/ports";

/** 按 behavior 指令构造 fake spawner。 */
function makeSpawner(behavior: LLMBehavior): Spawner {
  return async (_cmd, _args, _opts): Promise<SpawnResult> => {
    switch (behavior.kind) {
      case "ok":
        return {
          kind: "exit",
          code: 0,
          stdout: JSON.stringify({
            type: "result",
            subtype: "success",
            is_error: false,
            result: behavior.text,
          }),
          stderr: "",
        };
      case "not-installed":
        return { kind: "enoent" };
      case "timeout":
        return { kind: "timeout" };
      case "non-zero-exit":
        return {
          kind: "exit",
          code: behavior.exitCode,
          stdout: "",
          stderr: "some error",
        };
      case "unparseable-output":
        return {
          kind: "exit",
          code: 0,
          stdout: "not-a-json-blob",
          stderr: "",
        };
    }
  };
}

describe("ClaudeCodeLLMClient", () => {
  runLLMClientContract((behavior) =>
    new ClaudeCodeLLMClient({ spawner: makeSpawner(behavior) }),
  );

  describe("prompt dispatch", () => {
    it("passes prompt via stdin and extracts .result", async () => {
      let capturedInput = "";
      const spawner: Spawner = async (_cmd, _args, opts) => {
        capturedInput = opts.input;
        return {
          kind: "exit",
          code: 0,
          stdout: JSON.stringify({ result: "done" }),
          stderr: "",
        };
      };
      const client = new ClaudeCodeLLMClient({ spawner });
      const out = await client.complete("hello");
      expect(out).toBe("done");
      expect(capturedInput).toBe("hello");
    });

    it("uses -p --output-format json --no-session-persistence flags", async () => {
      let capturedArgs: string[] = [];
      const spawner: Spawner = async (_cmd, args, _opts) => {
        capturedArgs = args;
        return {
          kind: "exit",
          code: 0,
          stdout: JSON.stringify({ result: "ok" }),
          stderr: "",
        };
      };
      const client = new ClaudeCodeLLMClient({ spawner });
      await client.complete("x");
      expect(capturedArgs).toContain("-p");
      expect(capturedArgs).toContain("--output-format");
      expect(capturedArgs).toContain("json");
      expect(capturedArgs).toContain("--no-session-persistence");
    });
  });
});

describe("parseClaudeJsonOutput", () => {
  it("extracts .result field", () => {
    const out = parseClaudeJsonOutput(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "hello world",
      }),
    );
    expect(out).toBe("hello world");
  });

  it("throws on empty output", () => {
    expect(() => parseClaudeJsonOutput("")).toThrow(LLMClientError);
    expect(() => parseClaudeJsonOutput("   \n")).toThrow(LLMClientError);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseClaudeJsonOutput("not json")).toThrow(LLMClientError);
  });

  it("throws when is_error=true", () => {
    const stdout = JSON.stringify({
      type: "result",
      is_error: true,
      result: "rate limited",
    });
    expect(() => parseClaudeJsonOutput(stdout)).toThrow(/is_error/);
  });

  it("throws when .result missing or not string", () => {
    expect(() =>
      parseClaudeJsonOutput(JSON.stringify({ is_error: false })),
    ).toThrow(LLMClientError);
    expect(() =>
      parseClaudeJsonOutput(JSON.stringify({ result: 42 })),
    ).toThrow(LLMClientError);
  });
});
