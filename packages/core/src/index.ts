export { scoreEntry } from "./scorer.js";
export {
  compileMarkdownBlock,
  injectBlockIntoDoc,
  BLOCK_START,
  BLOCK_END,
} from "./compiler/markdown.js";
export {
  matchRules,
  type ToolCallContext,
} from "./matcher/keyword-matcher.js";
