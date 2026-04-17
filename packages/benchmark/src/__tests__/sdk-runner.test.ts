import { describe, it, expect } from "vitest";
import { FakeSdkRunner } from "../sdk-runner.js";

describe("FakeSdkRunner", () => {
  it("returns empty result when no key matches", async () => {
    const sdk = new FakeSdkRunner();
    const r = await sdk.run("anything", "/tmp");
    expect(r).toEqual({ output: "", tokensIn: 0, tokensOut: 0 });
  });

  it("returns matching response when prompt contains key", async () => {
    const sdk = new FakeSdkRunner();
    sdk.setResponse("foo", { output: "bar", tokensIn: 1, tokensOut: 2 });
    const r = await sdk.run("hello foo world", "/tmp");
    expect(r.output).toBe("bar");
  });

  it("setResponse overwrites prior key", async () => {
    const sdk = new FakeSdkRunner();
    sdk.setResponse("foo", { output: "v1", tokensIn: 0, tokensOut: 0 });
    sdk.setResponse("foo", { output: "v2", tokensIn: 0, tokensOut: 0 });
    const r = await sdk.run("foo", "/tmp");
    expect(r.output).toBe("v2");
  });
});
