import type { RawWikiItem } from "@teamagent/ports";

export interface JudgedWikiItem extends RawWikiItem {
  tldr: string;
  keywords: string[];
  valuable: boolean;
  rejectReason?: string;
}
