import type { JudgedWikiItem } from "./types.js";

export interface WikiEntry {
  id: string;
  tldr: string;
  keywords: string[];
  sourceUrl: string;
  sourceType: string;
  sourceId: string;
  publishedAt: Date;
  title: string;
}

export function buildWikiEntry(judged: JudgedWikiItem, id: string): WikiEntry {
  return {
    id,
    tldr: judged.tldr,
    keywords: judged.keywords,
    sourceUrl: judged.sourceUrl,
    sourceType: judged.sourceType,
    sourceId: judged.sourceId,
    publishedAt: judged.publishedAt,
    title: judged.title,
  };
}
