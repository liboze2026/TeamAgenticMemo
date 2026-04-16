import type { ExtractionInput } from "@teamagent/ports";

/**
 * npm audit --json 的宽松解析。只保留 high / critical 严重度。
 *
 * 期望形状（npm v7+）：
 * ```json
 * {
 *   "vulnerabilities": {
 *     "pkg-name": {
 *       "severity": "high" | "critical" | "moderate" | "low" | "info",
 *       "title": "...",
 *       "url": "..."
 *     }
 *   }
 * }
 * ```
 */
export function parseNpmAudit(raw: string): ExtractionInput[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!data || typeof data !== "object") return [];
  const vulns = (data as Record<string, unknown>).vulnerabilities;
  if (!vulns || typeof vulns !== "object") return [];

  const out: ExtractionInput[] = [];
  for (const [pkg, rawVuln] of Object.entries(
    vulns as Record<string, unknown>,
  )) {
    if (!rawVuln || typeof rawVuln !== "object") continue;
    const v = rawVuln as Record<string, unknown>;
    const severity =
      typeof v.severity === "string" ? v.severity.toLowerCase() : "";
    if (severity !== "high" && severity !== "critical") continue;
    const title = typeof v.title === "string" ? v.title : "";
    const url = typeof v.url === "string" ? v.url : "";
    out.push({
      kind: "npm-audit",
      context: `[severity=${severity}] ${pkg}: ${title} (${url || "no url"})`,
      weight: severity === "critical" ? 1.0 : 0.8,
    });
  }
  return out;
}

/** 调 runner 拿 `npm audit --json` 输出；包住 runner 方便测试。 */
export async function getNpmAuditOutput(
  runner: (cmd: string, opts: { cwd?: string }) => Promise<string>,
  cwd?: string,
): Promise<string> {
  try {
    return await runner("npm audit --json", { cwd });
  } catch (err) {
    // npm audit 在有漏洞时 exit code 非 0；如果输出还是 JSON，优先用它
    const message = err instanceof Error ? err.message : String(err);
    const match = message.match(/\{[\s\S]*\}$/);
    if (match) return match[0];
    // 否则向上抛
    throw err;
  }
}
