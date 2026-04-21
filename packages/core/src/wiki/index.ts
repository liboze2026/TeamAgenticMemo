export { filterByStack, filterByAge } from "./filter.js";
export { validateWikiItem, type ValidationResult } from "./validator.js";
export { buildWikiEntry, type WikiEntry } from "./builder.js";
export { detectStackPackages, mergeStack } from "./stack-packages.js";
export { autoSubscribe, STACK_TO_SOURCES } from "./stack-source-map.js";
export type { JudgedWikiItem } from "./types.js";
export { computeArchivals, type WikiEntrySnapshot, type SweepPolicy, type ArchiveReason, type ArchiveDecision } from "./sweeper.js";
