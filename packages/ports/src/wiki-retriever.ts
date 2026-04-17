export interface WikiInjectionEntry {
  knowledgeId: string;
  tldr: string;
  sourceType: string;
  publishedAt: Date;
  similarity: number;
}

export interface WikiQueryOptions {
  embedding: number[];
  minSimilarity: number;
  maxAgeDays: number;
  maxResults: number;
  now: Date;
  cooldownMinutes: number;
  sessionWindowMinutes: number;
  sessionMaxInjections: number;
}

export interface WikiRetrieverPort {
  query(opts: WikiQueryOptions): Promise<WikiInjectionEntry[]>;
  recordInjection(knowledgeIds: string[], now: Date): void;
}
