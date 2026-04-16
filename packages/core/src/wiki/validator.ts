import type { JudgedWikiItem } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateWikiItem(item: JudgedWikiItem): ValidationResult {
  if (!item.valuable)
    return { valid: false, reason: item.rejectReason ?? "haiku rejected" };
  if (!item.tldr || item.tldr.trim().length < 10)
    return { valid: false, reason: "tldr too short" };
  if (!item.keywords || item.keywords.length === 0)
    return { valid: false, reason: "no keywords" };
  if (!isValidUrl(item.sourceUrl))
    return { valid: false, reason: "invalid url" };
  return { valid: true };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
