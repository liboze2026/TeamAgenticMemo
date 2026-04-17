import { query } from "@anthropic-ai/claude-agent-sdk";

export interface SdkRunResult {
  output: string;
  tokensIn: number;
  tokensOut: number;
}

export interface SdkRunner {
  run(prompt: string, workdir: string): Promise<SdkRunResult>;
}

export class ClaudeSdkRunner implements SdkRunner {
  constructor(
    private timeoutMs: number = 60_000,
    private model: string = "claude-haiku-4-5-20251001",
  ) {}

  async run(prompt: string, workdir: string): Promise<SdkRunResult> {
    const abortController = new AbortController();
    const session = query({
      prompt,
      options: {
        cwd: workdir,
        settingSources: ["local"],
        permissionMode: "bypassPermissions",
        maxTurns: 5,
        abortController,
        model: this.model,
      },
    });

    let output = "";
    let tokensIn = 0;
    let tokensOut = 0;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const work = (async () => {
      try {
        for await (const msg of session) {
          if (msg.type === "assistant") {
            for (const block of msg.message.content) {
              if (block.type === "text") output += block.text;
            }
          }
          if (msg.type === "result") {
            tokensIn = msg.usage.input_tokens ?? 0;
            tokensOut = msg.usage.output_tokens ?? 0;
          }
        }
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        abortController.abort();
        session.close();
        reject(new Error("SDK timeout"));
      }, this.timeoutMs);
    });

    try {
      await Promise.race([work, timeoutPromise]);
    } catch (e) {
      work.catch(() => {}); // swallow post-abort rejection so it never surfaces unhandled
      throw e;
    }
    return { output, tokensIn, tokensOut };
  }
}

export class FakeSdkRunner implements SdkRunner {
  constructor(private responses: Map<string, SdkRunResult> = new Map()) {}

  setResponse(promptKey: string, result: SdkRunResult): void {
    this.responses.set(promptKey, result);
  }

  async run(prompt: string, _workdir: string): Promise<SdkRunResult> {
    for (const [key, result] of this.responses) {
      if (prompt.includes(key)) return result;
    }
    return { output: "", tokensIn: 0, tokensOut: 0 };
  }
}
