import type { RawWikiItem } from "@teamagent/ports";

export function filterByStack(item: RawWikiItem, stack: string[]): boolean {
  // substring match in title+content (case-insensitive), any stack item
  const text = (item.title + " " + item.content).toLowerCase();
  return stack.some((s) => text.includes(s.toLowerCase()));
}

export function filterByAge(item: RawWikiItem, maxAgeDays: number = 180): boolean {
  const age = (Date.now() - item.publishedAt.getTime()) / 86_400_000;
  return age <= maxAgeDays;
}
