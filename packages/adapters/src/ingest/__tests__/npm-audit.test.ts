import { describe, it, expect, vi } from "vitest";
import { parseNpmAudit, getNpmAuditOutput } from "../npm-audit.js";

describe("parseNpmAudit", () => {
  it("keeps only high and critical severities", () => {
    const raw = JSON.stringify({
      vulnerabilities: {
        lodash: {
          severity: "high",
          title: "Prototype Pollution in lodash",
          url: "https://github.com/advisories/1",
        },
        moment: { severity: "low", title: "minor" },
        foo: { severity: "critical", title: "RCE", url: "https://x/2" },
      },
    });
    const inputs = parseNpmAudit(raw);
    expect(inputs).toHaveLength(2);
    const pkgs = inputs.map((i) => i.context);
    expect(pkgs.some((s) => s.includes("lodash"))).toBe(true);
    expect(pkgs.some((s) => s.includes("foo"))).toBe(true);
    expect(pkgs.some((s) => s.includes("moment"))).toBe(false);
  });

  it("weights critical higher than high", () => {
    const raw = JSON.stringify({
      vulnerabilities: {
        a: { severity: "high" },
        b: { severity: "critical" },
      },
    });
    const inputs = parseNpmAudit(raw);
    const critical = inputs.find((i) => i.context.includes("[severity=critical]"))!;
    const high = inputs.find((i) => i.context.includes("[severity=high]"))!;
    expect(critical.weight).toBeGreaterThan(high.weight);
  });

  it("empty vulnerabilities → empty array", () => {
    const raw = JSON.stringify({ vulnerabilities: {} });
    expect(parseNpmAudit(raw)).toEqual([]);
  });

  it("malformed JSON → empty array (defensive)", () => {
    expect(parseNpmAudit("not json")).toEqual([]);
  });

  it("handles missing title / url gracefully", () => {
    const raw = JSON.stringify({
      vulnerabilities: { bare: { severity: "high" } },
    });
    const inputs = parseNpmAudit(raw);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.context).toContain("bare");
    expect(inputs[0]!.context).toContain("no url");
  });
});

describe("getNpmAuditOutput", () => {
  it("invokes runner with 'npm audit --json'", async () => {
    const runner = vi.fn().mockResolvedValue('{"vulnerabilities":{}}');
    const out = await getNpmAuditOutput(runner);
    expect(runner).toHaveBeenCalledWith("npm audit --json", expect.any(Object));
    expect(out).toContain("vulnerabilities");
  });

  it("recovers JSON from error message when runner throws", async () => {
    const runner = vi.fn().mockRejectedValue(
      new Error('Command failed\n{"vulnerabilities":{"x":{"severity":"high"}}}'),
    );
    const out = await getNpmAuditOutput(runner);
    expect(out).toContain("vulnerabilities");
  });
});
