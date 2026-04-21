import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface LastPullRecord {
  attemptedAt: Date;
  added: number;
  archived: number;
}

interface RawRecord {
  attemptedAt: string;
  added: number;
  archived: number;
}

const FILE_NAME = "wiki-last-pull.json";

export class LastPullMarker {
  constructor(private baseDir: string) {}

  private path(): string {
    return join(this.baseDir, FILE_NAME);
  }

  read(): LastPullRecord | null {
    try {
      const raw = readFileSync(this.path(), "utf-8");
      const obj = JSON.parse(raw) as RawRecord;
      if (typeof obj.attemptedAt !== "string") return null;
      return {
        attemptedAt: new Date(obj.attemptedAt),
        added: obj.added ?? 0,
        archived: obj.archived ?? 0,
      };
    } catch {
      return null;
    }
  }

  write(rec: LastPullRecord): void {
    mkdirSync(this.baseDir, { recursive: true });
    const raw: RawRecord = {
      attemptedAt: rec.attemptedAt.toISOString(),
      added: rec.added,
      archived: rec.archived,
    };
    writeFileSync(this.path(), JSON.stringify(raw, null, 2), "utf-8");
  }

  shouldSkip(now: Date, debounceHours: number): boolean {
    const r = this.read();
    if (!r) return false;
    const elapsedMs = now.getTime() - r.attemptedAt.getTime();
    return elapsedMs < debounceHours * 3_600_000;
  }
}
