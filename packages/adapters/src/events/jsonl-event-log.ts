import fs from "node:fs";
import path from "node:path";
import type { PersistedEvent } from "@teamagent/types";

/**
 * 追加写 events.jsonl 的 adapter。
 *
 * 用 `appendFileSync` 而非"读+改+写"——高并发场景下短进程仍能可靠落盘。
 * 多个 hook 实例同时追加是安全的（OS 级 append 原子性，每行 < pipe buffer）。
 */
export class JsonlEventLog {
  constructor(private readonly filePath: string) {}

  append(event: PersistedEvent): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(this.filePath, JSON.stringify(event) + "\n", "utf-8");
  }

  readAll(): PersistedEvent[] {
    if (!fs.existsSync(this.filePath)) return [];
    const content = fs.readFileSync(this.filePath, "utf-8");
    const out: PersistedEvent[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed) as PersistedEvent);
      } catch {
        continue;
      }
    }
    return out;
  }
}
