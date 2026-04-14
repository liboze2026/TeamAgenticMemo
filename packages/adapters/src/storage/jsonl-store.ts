import fs from "node:fs";
import path from "node:path";
import { KnowledgeEntrySchema, type KnowledgeEntry } from "@teamagent/types";
import type { KnowledgeStore, QueryOptions } from "@teamagent/ports";

/**
 * JSONL 文件存储。每行一条 KnowledgeEntry。
 *
 * 原子性保证：
 * - 所有写入通过"写入 temp + fs.renameSync" 完成，不会看到半成品文件
 * - 损坏的行（无法 JSON.parse 或不符合 schema）在加载时被跳过
 * - 父目录自动创建
 */
export class JsonlKnowledgeStore implements KnowledgeStore {
  private entries = new Map<string, KnowledgeEntry>();

  constructor(private readonly filePath: string) {
    this.ensureFile();
    this.load();
  }

  private ensureFile(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, "", "utf-8");
  }

  private load(): void {
    const content = fs.readFileSync(this.filePath, "utf-8");
    if (!content.trim()) return;

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed);
        const entry = KnowledgeEntrySchema.parse(raw);
        this.entries.set(entry.id, entry);
      } catch {
        // 跳过损坏行，不中断加载其他行
        continue;
      }
    }
  }

  private persist(): void {
    const lines = [...this.entries.values()].map((e) => JSON.stringify(e));
    const content = lines.length > 0 ? lines.join("\n") + "\n" : "";

    // 原子替换：写入临时文件，然后 rename
    const tmpPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, content, "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  getAll(): KnowledgeEntry[] {
    return [...this.entries.values()];
  }

  getActive(): KnowledgeEntry[] {
    return this.getAll().filter((e) => e.status === "active");
  }

  getById(id: string): KnowledgeEntry | undefined {
    return this.entries.get(id);
  }

  add(entry: KnowledgeEntry): void {
    if (this.entries.has(entry.id)) {
      throw new Error(`Duplicate entry id: ${entry.id}`);
    }
    const validated = KnowledgeEntrySchema.parse(entry);
    this.entries.set(validated.id, validated);
    this.persist();
  }

  update(id: string, patch: Partial<KnowledgeEntry>): void {
    const existing = this.entries.get(id);
    if (!existing) throw new Error(`Entry not found: ${id}`);
    const merged = KnowledgeEntrySchema.parse({ ...existing, ...patch });
    this.entries.set(id, merged);
    this.persist();
  }

  delete(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  count(): number {
    return this.entries.size;
  }

  query(options: QueryOptions): KnowledgeEntry[] {
    let result = options.includeArchived ? this.getAll() : this.getActive();

    if (options.category) {
      result = result.filter((e) => e.category === options.category);
    }
    if (options.tags && options.tags.length > 0) {
      result = result.filter((e) =>
        options.tags!.some((tag) => e.tags.includes(tag)),
      );
    }
    if (options.minConfidence !== undefined) {
      result = result.filter((e) => e.confidence >= options.minConfidence!);
    }
    if (options.scope?.level) {
      result = result.filter((e) => e.scope.level === options.scope!.level);
    }
    if (options.scope?.project) {
      result = result.filter(
        (e) => !e.scope.project || e.scope.project === options.scope!.project,
      );
    }
    if (options.keyword) {
      const kw = options.keyword.toLowerCase();
      result = result.filter(
        (e) =>
          e.trigger.toLowerCase().includes(kw) ||
          e.tags.some((t) => t.toLowerCase().includes(kw)) ||
          e.wrong_pattern.toLowerCase().includes(kw) ||
          e.correct_pattern.toLowerCase().includes(kw),
      );
    }

    if (options.limit !== undefined) {
      result = result.slice(0, options.limit);
    }
    return result;
  }
}
