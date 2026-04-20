// packages/cli/src/__tests__/doctor.test.ts
import { describe, it, expect } from "vitest";
import {
  renderDoctorResult,
  parseDoctorArgs,
  type DoctorCheckResult,
  type DoctorResult,
} from "../commands/doctor.js";

function makeResult(overrides: Partial<DoctorResult> = {}): DoctorResult {
  return {
    checks: [],
    passed: 0,
    failed: 0,
    skipped: 0,
    allPassed: true,
    ...overrides,
  };
}

describe("renderDoctorResult", () => {
  it("shows all-pass message when allPassed=true", () => {
    const out = renderDoctorResult(makeResult({ allPassed: true, passed: 8 }));
    expect(out).toContain("全部检查通过");
    expect(out).toContain("TeamAgent 运行正常");
  });

  it("shows failure count and fix hint when failed > 0", () => {
    const checks: DoctorCheckResult[] = [
      { name: "node-version", status: "fail", detail: "v18.0.0 (需要 ≥ 22)", fix: "nvm install 22" },
      { name: "claude-code", status: "skip", detail: "跳过" },
    ];
    const out = renderDoctorResult(makeResult({
      checks,
      passed: 0,
      failed: 1,
      skipped: 1,
      allPassed: false,
    }));
    expect(out).toContain("❌ node-version");
    expect(out).toContain("nvm install 22");
    expect(out).toContain("⏭");
    expect(out).toContain("1 项失败");
  });

  it("shows ✅ for passing checks", () => {
    const checks: DoctorCheckResult[] = [
      { name: "node-version", status: "pass", detail: "v22.4.0" },
    ];
    const out = renderDoctorResult(makeResult({ checks, passed: 1, allPassed: true }));
    expect(out).toContain("✅ node-version");
    expect(out).toContain("v22.4.0");
  });
});

describe("parseDoctorArgs", () => {
  it("defaults all false", () => {
    const opts = parseDoctorArgs([]);
    expect(opts.fix).toBe(false);
    expect(opts.json).toBe(false);
    expect(opts.postinstall).toBe(false);
  });

  it("parses --fix --json --postinstall", () => {
    const opts = parseDoctorArgs(["--fix", "--json", "--postinstall"]);
    expect(opts.fix).toBe(true);
    expect(opts.json).toBe(true);
    expect(opts.postinstall).toBe(true);
  });
});
