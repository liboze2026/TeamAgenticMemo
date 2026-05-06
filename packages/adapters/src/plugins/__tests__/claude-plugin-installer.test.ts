import { describe, it, expect } from "vitest";
import {
  ClaudePluginInstaller,
  type PluginCmdResult,
  type PluginCmdSpawner,
} from "../claude-plugin-installer.js";

function fakeSpawner(
  responses: Array<{ match: string[]; result: PluginCmdResult }>,
): PluginCmdSpawner {
  return async (args) => {
    for (const r of responses) {
      if (r.match.every((m, i) => args[i] === m)) return r.result;
    }
    return { kind: "error", message: `unmatched args: ${args.join(" ")}` };
  };
}

describe("ClaudePluginInstaller.addMarketplace", () => {
  it("returns added when CLI prints ✔ with no 'already' marker", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: fakeSpawner([
        {
          match: ["plugin", "marketplace", "add", "anthropics/claude-plugins-official"],
          result: {
            kind: "exit",
            code: 0,
            stdout: "Adding marketplace…✔ Successfully added marketplace 'claude-plugins-official'",
            stderr: "",
          },
        },
      ]),
    });
    const out = await installer.addMarketplace({
      name: "claude-plugins-official",
      repo: "anthropics/claude-plugins-official",
    });
    expect(out.status).toBe("added");
    expect(out.detail).toContain("claude-plugins-official");
  });

  it("returns already when CLI prints 'already on disk'", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: fakeSpawner([
        {
          match: ["plugin", "marketplace", "add", "anthropics/claude-plugins-official"],
          result: {
            kind: "exit",
            code: 0,
            stdout:
              "Adding marketplace…✔ Marketplace 'claude-plugins-official' already on disk — declared in user settings",
            stderr: "",
          },
        },
      ]),
    });
    const out = await installer.addMarketplace({
      name: "claude-plugins-official",
      repo: "anthropics/claude-plugins-official",
    });
    expect(out.status).toBe("already");
  });

  it("returns failed when CLI prints ✘", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: fakeSpawner([
        {
          match: ["plugin", "marketplace", "add", "bogus/repo"],
          result: {
            kind: "exit",
            code: 0,
            stdout: "Adding marketplace…✘ Failed to add marketplace: ssh error\n",
            stderr: "",
          },
        },
      ]),
    });
    const out = await installer.addMarketplace({
      name: "bogus",
      repo: "bogus/repo",
    });
    expect(out.status).toBe("failed");
    expect(out.detail).toMatch(/Failed|ssh/);
  });

  it("returns failed with friendly detail when claude CLI is missing", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: async () => ({ kind: "enoent" }),
    });
    const out = await installer.addMarketplace({ name: "x", repo: "a/b" });
    expect(out.status).toBe("failed");
    expect(out.detail).toMatch(/claude/i);
    expect(out.detail).toMatch(/PATH|not.*found|未找到/i);
  });

  it("returns failed on spawn timeout", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: async () => ({ kind: "timeout" }),
    });
    const out = await installer.addMarketplace({ name: "x", repo: "a/b" });
    expect(out.status).toBe("failed");
    expect(out.detail).toMatch(/timeout|超时/i);
  });

  it("returns failed on generic spawn error", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: async () => ({ kind: "error", message: "boom" }),
    });
    const out = await installer.addMarketplace({ name: "x", repo: "a/b" });
    expect(out.status).toBe("failed");
    expect(out.detail).toContain("boom");
  });

  it("returns failed when exit code is non-zero", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: async () => ({
        kind: "exit",
        code: 2,
        stdout: "",
        stderr: "unknown flag",
      }),
    });
    const out = await installer.addMarketplace({ name: "x", repo: "a/b" });
    expect(out.status).toBe("failed");
  });
});

describe("ClaudePluginInstaller.installPlugin", () => {
  it("returns added on 'Successfully installed'", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: fakeSpawner([
        {
          match: ["plugin", "install", "superpowers@claude-plugins-official"],
          result: {
            kind: "exit",
            code: 0,
            stdout:
              "Installing plugin \"superpowers@claude-plugins-official\"...✔ Successfully installed plugin: superpowers@claude-plugins-official (scope: user)",
            stderr: "",
          },
        },
      ]),
    });
    const out = await installer.installPlugin({
      plugin: "superpowers",
      marketplace: "claude-plugins-official",
    });
    expect(out.status).toBe("added");
    expect(out.detail).toContain("superpowers@claude-plugins-official");
  });

  it("returns already when CLI prints 'already installed'", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: fakeSpawner([
        {
          match: ["plugin", "install", "sales@knowledge-work-plugins"],
          result: {
            kind: "exit",
            code: 0,
            stdout: "✔ Plugin sales@knowledge-work-plugins is already installed",
            stderr: "",
          },
        },
      ]),
    });
    const out = await installer.installPlugin({
      plugin: "sales",
      marketplace: "knowledge-work-plugins",
    });
    expect(out.status).toBe("already");
  });

  it("returns failed on ✘", async () => {
    const installer = new ClaudePluginInstaller({
      spawner: fakeSpawner([
        {
          match: ["plugin", "install", "ghost@knowledge-work-plugins"],
          result: {
            kind: "exit",
            code: 0,
            stdout: "Installing plugin…✘ Failed: plugin 'ghost' not found in marketplace 'knowledge-work-plugins'",
            stderr: "",
          },
        },
      ]),
    });
    const out = await installer.installPlugin({
      plugin: "ghost",
      marketplace: "knowledge-work-plugins",
    });
    expect(out.status).toBe("failed");
    expect(out.detail).toMatch(/not found|Failed/);
  });

  it("passes scope flag through", async () => {
    let capturedArgs: string[] = [];
    const installer = new ClaudePluginInstaller({
      spawner: async (args) => {
        capturedArgs = [...args];
        return {
          kind: "exit",
          code: 0,
          stdout: "✔ Successfully installed plugin",
          stderr: "",
        };
      },
    });
    await installer.installPlugin(
      { plugin: "sales", marketplace: "knowledge-work-plugins" },
      { scope: "project" },
    );
    expect(capturedArgs).toContain("--scope");
    expect(capturedArgs).toContain("project");
  });
});
