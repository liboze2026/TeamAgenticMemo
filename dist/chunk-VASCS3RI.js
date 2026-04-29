import {
  DEFAULT_FIRE_THRESHOLD,
  computeEnforcement,
  normalizeChannel
} from "./chunk-4EBMEK5Z.js";
import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../core/src/index.ts
init_esm_shims();

// ../core/src/scorer.ts
init_esm_shims();
function scoreEntry(entry, maxHitCount, now) {
  const confidenceScore = entry.confidence * 0.4;
  const hitNormalized = maxHitCount > 0 ? Math.min(1, entry.hit_count / maxHitCount) : 0;
  const hitScore = hitNormalized * 0.3;
  const nowMs = Date.parse(now);
  const hitMs = entry.last_hit_at ? Date.parse(entry.last_hit_at) : 0;
  let daysSinceHit;
  if (!Number.isFinite(nowMs)) {
    daysSinceHit = 90;
  } else {
    daysSinceHit = hitMs > 0 ? (nowMs - hitMs) / (1e3 * 60 * 60 * 24) : 90;
  }
  const recency = Math.max(0, 1 - daysSinceHit / 90);
  const recencyScore = recency * 0.2;
  const enforcementScore = ENFORCEMENT_WEIGHT[entry.enforcement] * 0.1;
  return confidenceScore + hitScore + recencyScore + enforcementScore;
}
var ENFORCEMENT_WEIGHT = {
  block: 1,
  warn: 0.7,
  suggest: 0.4,
  passive: 0.1
};

// ../core/src/compiler/markdown.ts
init_esm_shims();
var BLOCK_START = "<!-- TEAMAGENT:START - \u81EA\u52A8\u7BA1\u7406\uFF0C\u8BF7\u52FF\u624B\u52A8\u7F16\u8F91 -->";
var BLOCK_END = "<!-- TEAMAGENT:END -->";
var DEFAULT_MAX_LINES = 50;
var DEFAULT_CONTENT_BUDGET = DEFAULT_MAX_LINES - 5;
function charNgrams(text, n = 3) {
  const s = text.replace(/\s+/g, " ").trim().toLowerCase();
  const out = /* @__PURE__ */ new Set();
  if (s.length < n) {
    if (s.length > 0) out.add(s);
    return out;
  }
  for (let i = 0; i <= s.length - n; i++) out.add(s.slice(i, i + n));
  return out;
}
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
function sanitizeBlockMarkers(text) {
  return text.replace(/TEAMAGENT:(START|END)/g, "TEAMAGENT\u200B:$1");
}
function formatEntry(entry) {
  const conf = entry.confidence.toFixed(2);
  const hits = entry.hit_count > 0 ? `, ${entry.hit_count}\u6B21\u547D\u4E2D` : "";
  const sourceTag = entry.source === "team-shared" ? " [\u56E2\u961F]" : entry.source === "preset" ? " [\u9884\u7F6E]" : "";
  const correct = sanitizeBlockMarkers(entry.correct_pattern);
  const wrong = sanitizeBlockMarkers(entry.wrong_pattern ?? "");
  const reason = sanitizeBlockMarkers(entry.reasoning);
  if (entry.type === "avoidance" && wrong) {
    return `- \u4F7F\u7528 ${correct} \u800C\u975E ${wrong}\u2014\u2014${reason} [${conf}${hits}]${sourceTag}`;
  }
  return `- ${correct}\u2014\u2014${reason} [${conf}${hits}]${sourceTag}`;
}
function compileMarkdownBlock(entries, now, options = {}) {
  const limit = Math.max(1, options.limit ?? DEFAULT_CONTENT_BUDGET);
  const active = entries.filter((e) => e.status === "active");
  if (options.presetOnly) {
    const presets = active.filter((e) => e.source === "preset");
    if (presets.length === 0) {
      return [BLOCK_START, "## TeamAgent \u5143\u539F\u5219", "\uFF08\u65E0\u5143\u539F\u5219\uFF09", BLOCK_END].join("\n");
    }
    const lines2 = presets.map((e) => formatEntry(e));
    return [BLOCK_START, "## TeamAgent \u5143\u539F\u5219", ...lines2, BLOCK_END].join("\n");
  }
  const tierFiltered = options.tierFilter ? active.filter((e) => options.tierFilter.includes(e.current_tier)) : active;
  if (tierFiltered.length === 0) {
    return [BLOCK_START, "## TeamAgent \u7ECF\u9A8C", "\u6682\u65E0\u7ECF\u9A8C\uFF0C\u4F7F\u7528\u8FC7\u7A0B\u4E2D\u4F1A\u81EA\u52A8\u79EF\u7D2F\u3002", BLOCK_END].join("\n");
  }
  const maxHitCount = Math.max(1, ...tierFiltered.map((e) => e.hit_count));
  const sorted = tierFiltered.map((e) => ({ entry: e, score: scoreEntry(e, maxHitCount, now) })).sort((a, b) => b.score - a.score);
  const countFn = options.countTokens ?? ((s) => Math.ceil(s.length / 3.5));
  let usedTokens = 0;
  const lines = [];
  let truncatedCount = 0;
  let droppedByDiversity = 0;
  const threshold = options.diversityThreshold;
  const selectedNgrams = [];
  const entryFingerprint = (e) => [e.correct_pattern, e.wrong_pattern, e.reasoning].filter(Boolean).join(" ");
  for (const { entry } of sorted) {
    if (threshold !== void 0) {
      const fp = charNgrams(entryFingerprint(entry));
      let maxSim = 0;
      for (const prev of selectedNgrams) {
        const sim = jaccard(fp, prev);
        if (sim > maxSim) maxSim = sim;
        if (maxSim >= threshold) break;
      }
      if (maxSim >= threshold) {
        droppedByDiversity++;
        continue;
      }
      selectedNgrams.push(fp);
    }
    if (options.tokenBudget !== void 0) {
      const line = formatEntry(entry);
      const lineTokens = countFn(line);
      if (usedTokens + lineTokens > options.tokenBudget) {
        truncatedCount++;
        continue;
      }
      usedTokens += lineTokens;
      lines.push(line);
    } else {
      if (lines.length >= limit) break;
      lines.push(formatEntry(entry));
    }
  }
  const total = active.length;
  const shown = lines.length;
  let header;
  if (options.tokenBudget !== void 0) {
    if (truncatedCount > 0) {
      header = `## TeamAgent \u7ECF\u9A8C\uFF08${total}\u6761\u6D3B\u8DC3\u77E5\u8BC6\uFF0C\u4E3A\u4F60\u7F16\u8BD1\u4E86 ${shown} \u6761\uFF08token \u9884\u7B97 ${options.tokenBudget}\uFF09)`;
    } else {
      header = `## TeamAgent \u7ECF\u9A8C\uFF08${total}\u6761\u6D3B\u8DC3\u77E5\u8BC6\uFF09`;
    }
  } else {
    header = total > shown ? `## TeamAgent \u7ECF\u9A8C\uFF08${total}\u6761\u6D3B\u8DC3\u77E5\u8BC6\uFF0C\u4E3A\u4F60\u7F16\u8BD1\u4E86Top ${shown}\uFF09` : `## TeamAgent \u7ECF\u9A8C\uFF08${total}\u6761\u6D3B\u8DC3\u77E5\u8BC6\uFF09`;
  }
  const parts = [BLOCK_START, header, ...lines];
  if (truncatedCount > 0 && options.tokenBudget !== void 0) {
    parts.push(`> \u8FD8\u6709 ${truncatedCount} \u6761 canonical+ \u89C4\u5219\u56E0 token \u9884\u7B97\u672A\u663E\u793A\uFF08teamagent compile --dry-run \u67E5\u770B\uFF09`);
  }
  if (droppedByDiversity > 0) {
    parts.push(`> \u53E6\u6709 ${droppedByDiversity} \u6761\u56E0\u4E0E\u5DF2\u9009\u6761\u76EE\u8FD1\u4E49\uFF08Jaccard \u2265 ${threshold}\uFF09\u88AB\u591A\u6837\u6027\u8FC7\u6EE4`);
  }
  parts.push(BLOCK_END);
  return parts.join("\n");
}
function injectBlockIntoDoc(existing, block) {
  const startTagRegex = /<!--\s*TEAMAGENT:START[^>]*-->/;
  const endTagRegex = /<!--\s*TEAMAGENT:END[^>]*-->/;
  const startMatch = existing.match(startTagRegex);
  const endMatch = existing.match(endTagRegex);
  if (startMatch && endMatch && startMatch.index !== void 0 && endMatch.index !== void 0 && endMatch.index > startMatch.index) {
    const before = existing.slice(0, startMatch.index);
    const after = existing.slice(endMatch.index + endMatch[0].length);
    return before + block + after;
  }
  if (existing === "") {
    return block + "\n";
  }
  const trimmed = existing.replace(/\n+$/, "");
  return trimmed + "\n\n" + block + "\n";
}

// ../core/src/matcher/legacy/keyword-matcher.ts
init_esm_shims();
var ENFORCEMENT_RANK = {
  block: 3,
  warn: 2,
  suggest: 1,
  passive: 0
};
function matchRules(ctx, rules) {
  const inputText = extractInputText(ctx);
  const inputTextLower = inputText.toLowerCase();
  const filePath = stringField(ctx.input, "file_path");
  const matches = [];
  for (const rule of rules) {
    if (rule.status !== "active") continue;
    if (!rule.wrong_pattern) continue;
    if (normalizeChannel(rule.channel) !== "tool-action") continue;
    if (!checkScope(rule, filePath)) continue;
    const patterns = splitPatterns(rule.wrong_pattern);
    const matched = patterns.some((p) => patternMatches(inputText, inputTextLower, p));
    if (matched) matches.push(rule);
  }
  matches.sort(
    (a, b) => (ENFORCEMENT_RANK[b.enforcement] ?? 0) - (ENFORCEMENT_RANK[a.enforcement] ?? 0)
  );
  return matches;
}
function extractInputText(ctx) {
  const parts = [];
  for (const key of [
    "command",
    "content",
    "file_path",
    "url",
    "old_string",
    "new_string",
    "pattern",
    "query",
    "prompt"
  ]) {
    const v = ctx.input[key];
    if (typeof v === "string") parts.push(v);
  }
  return parts.join("\n");
}
function stringField(input, key) {
  const v = input[key];
  return typeof v === "string" ? v : void 0;
}
var MIN_TOKEN_LENGTH = 3;
function splitPatterns(raw) {
  const tokens = raw.split("|").map((s) => s.trim()).filter((s) => s.length >= MIN_TOKEN_LENGTH);
  return tokens.length > 0 ? tokens : [raw.trim()];
}
function patternMatches(inputText, inputTextLower, pattern) {
  const token = pattern.trim();
  if (!token) return false;
  if (/^[a-z0-9_-]+$/i.test(token)) {
    return plainTokenMatches(inputTextLower, token.toLowerCase());
  }
  return inputTextLower.includes(token.toLowerCase());
}
function plainTokenMatches(inputTextLower, tokenLower) {
  let idx = inputTextLower.indexOf(tokenLower);
  while (idx !== -1) {
    const before = idx === 0 ? "" : inputTextLower[idx - 1];
    const afterIdx = idx + tokenLower.length;
    const after = afterIdx >= inputTextLower.length ? "" : inputTextLower[afterIdx];
    if (!isPlainTokenChar(before) && !isPlainTokenChar(after)) return true;
    idx = inputTextLower.indexOf(tokenLower, idx + 1);
  }
  return false;
}
function isPlainTokenChar(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 97 && code <= 122 || code >= 48 && code <= 57 || ch === "_" || ch === "-";
}
function checkScope(rule, filePath) {
  if (!filePath) return true;
  const fileTypes = rule.scope.file_types;
  if (fileTypes && fileTypes.length > 0) {
    const ok = fileTypes.some((ft) => matchesGlob(ft, filePath));
    if (!ok) return false;
  }
  const paths = rule.scope.paths;
  if (paths && paths.length > 0) {
    const ok = paths.some((p) => matchesGlob(p, filePath));
    if (!ok) return false;
  }
  return true;
}
function matchesGlob(pattern, target) {
  const SPECIAL_RE = /[.+?^${}()|[\]\\]/g;
  const escaped = pattern.replace(SPECIAL_RE, "\\$&").replace(/\*\*/g, "{{DSTAR}}").replace(/\*/g, "[^/]*").replace(/{{DSTAR}}/g, ".*");
  const re = new RegExp(`^${escaped}$`);
  if (re.test(target)) return true;
  if (!pattern.includes("/")) {
    const slash = target.lastIndexOf("/");
    const basename = slash >= 0 ? target.slice(slash + 1) : target;
    return re.test(basename);
  }
  return false;
}

// ../core/src/matcher/match.ts
init_esm_shims();

// ../core/src/matcher/legacy/ast-context.ts
init_esm_shims();
import { createRequire } from "module";
import { Parser, Language } from "web-tree-sitter";
var require2 = createRequire(import.meta.url);
var initialized = false;
var parsers = /* @__PURE__ */ new Map();
var WASM_MAP = {
  typescript: "tree-sitter-typescript/tree-sitter-typescript.wasm",
  javascript: "tree-sitter-typescript/tree-sitter-typescript.wasm",
  tsx: "tree-sitter-typescript/tree-sitter-tsx.wasm",
  python: "tree-sitter-python/tree-sitter-python.wasm"
};
async function initAstMatcher() {
  if (initialized) return;
  await Parser.init({
    locateFile: (name) => require2.resolve(`web-tree-sitter/${name}`)
  });
  for (const [lang, wasmRelPath] of Object.entries(WASM_MAP)) {
    if (parsers.has(lang)) continue;
    try {
      const fullPath = require2.resolve(wasmRelPath);
      const language = await Language.load(fullPath);
      const parser = new Parser();
      parser.setLanguage(language);
      parsers.set(lang, parser);
    } catch {
    }
  }
  initialized = true;
}
function isInsideCommentOrString(code, offset, lang) {
  const parser = parsers.get(lang);
  if (!parser) return false;
  const tree = parser.parse(code);
  if (!tree) return false;
  const node = tree.rootNode.descendantForIndex(offset);
  let cur = node;
  while (cur) {
    const t = cur.type;
    if (t === "comment" || t === "line_comment" || t === "block_comment") {
      tree.delete();
      return true;
    }
    if (t === "string" || t === "string_literal" || t === "string_fragment" || t === "template_string") {
      if (hasAncestor(cur, /* @__PURE__ */ new Set(["import_statement", "export_statement"]))) {
        tree.delete();
        return false;
      }
      tree.delete();
      return true;
    }
    cur = cur.parent;
  }
  tree.delete();
  return false;
}
function hasAncestor(node, types) {
  let cur = node;
  while (cur) {
    if (types.has(cur.type)) return true;
    cur = cur.parent;
  }
  return false;
}

// ../core/src/matcher/match.ts
var DOC_EXTENSIONS = /* @__PURE__ */ new Set(["md", "rst", "txt", "mdx"]);
var EXT_TO_LANG = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python"
};
function fileExt(filePath) {
  if (!filePath) return void 0;
  return filePath.split(".").pop()?.toLowerCase();
}
async function matchRules2(ctx, rules, _deps) {
  const ext = fileExt(ctx.file_path);
  if (ext && DOC_EXTENSIONS.has(ext)) {
    return { matched: [] };
  }
  const toolCtx = {
    toolName: "Write",
    input: { ...ctx }
  };
  const candidates = matchRules(toolCtx, rules);
  if (candidates.length === 0) return { matched: [] };
  const content = typeof ctx.content === "string" ? ctx.content : void 0;
  const lang = ext ? EXT_TO_LANG[ext] : void 0;
  if (!content || !lang) {
    return { matched: candidates };
  }
  await initAstMatcher();
  const filtered = [];
  for (const rule of candidates) {
    if (!rule.wrong_pattern) {
      filtered.push(rule);
      continue;
    }
    const patterns = rule.wrong_pattern.split("|").map((p) => p.trim()).filter((p) => p.length >= 3);
    let hasRealHit = false;
    for (const pattern of patterns) {
      let offset = content.toLowerCase().indexOf(pattern.toLowerCase());
      while (offset !== -1) {
        if (!isInsideCommentOrString(content, offset, lang)) {
          hasRealHit = true;
          break;
        }
        offset = content.toLowerCase().indexOf(pattern.toLowerCase(), offset + 1);
      }
      if (hasRealHit) break;
    }
    if (hasRealHit) filtered.push(rule);
  }
  return { matched: filtered };
}

// ../core/src/matcher/soft-and-scorer.ts
init_esm_shims();
var DEFAULT_SOFTAND = {
  w1: 0.4,
  w2: 0.4,
  w3: 0.3,
  w4: 0.5,
  tauFloor: 0.5
};
function scoreSoftAnd(args) {
  const w = args.weights ?? DEFAULT_SOFTAND;
  const minSim = Math.min(args.triggerSim, args.patternSim);
  const floor = Math.max(0, w.tauFloor - minSim);
  const hnMax = args.hardNegativeSims.length > 0 ? Math.max(...args.hardNegativeSims) : 0;
  return w.w1 * args.triggerSim + w.w2 * args.patternSim - w.w3 * floor - w.w4 * hnMax;
}

// ../core/src/matcher/semantic-matcher.ts
init_esm_shims();
function cosine(a, b) {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
async function semanticMatch(args) {
  const embedResult = await args.embedder.embed([
    args.contextText || " ",
    args.actionText || " "
  ]);
  const ctxVec = embedResult[0] ?? [];
  const actVec = embedResult[1] ?? [];
  const candidates = await args.retriever.retrieve({
    contextText: args.contextText,
    actionText: args.actionText,
    contextVec: new Float32Array(ctxVec),
    actionVec: new Float32Array(actVec),
    scope: args.scope,
    topK: args.topK
  });
  const debug = globalThis.process?.env?.TEAMAGENT_HOOK_DEBUG === "1";
  const scored = candidates.map((c) => {
    const raw = c.rule.hard_negatives;
    const hardNegVecs = Array.isArray(raw) ? raw.filter(Array.isArray) : typeof raw === "string" && raw ? (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    })() : [];
    const hnSims = hardNegVecs.map((hn) => cosine(ctxVec, hn));
    const score = scoreSoftAnd({
      triggerSim: c.triggerSim,
      patternSim: c.patternSim,
      hardNegativeSims: hnSims
    });
    const hardNegSim = hnSims.length > 0 ? Math.max(...hnSims) : 0;
    return {
      rule: c.rule,
      score,
      triggerSim: c.triggerSim,
      patternSim: c.patternSim,
      hardNegSim
    };
  });
  if (debug) {
    const proc = globalThis.process;
    proc?.stderr?.write?.(
      `[teamagent-matcher] scope=${args.scope.level} scored ${scored.length} candidates
`
    );
    for (const m of scored.slice(0, 5)) {
      const ft = m.rule.fire_threshold ?? DEFAULT_FIRE_THRESHOLD;
      const passed = m.score > ft;
      proc?.stderr?.write?.(
        `[teamagent-matcher]   ${m.rule.id} t=${m.triggerSim.toFixed(3)} p=${m.patternSim.toFixed(3)} hn=${m.hardNegSim.toFixed(3)} score=${m.score.toFixed(3)} >${ft.toFixed(2)}? ${passed ? "PASS" : "drop"}
`
      );
    }
  }
  return scored.filter((m) => m.score > (m.rule.fire_threshold ?? DEFAULT_FIRE_THRESHOLD)).sort((a, b) => b.score - a.score);
}

// ../core/src/ranking/confidence-rank.ts
init_esm_shims();
var TIER_FACTOR = {
  canonical: 1,
  enforced: 1,
  full: 1,
  stable: 0.9,
  probation: 0.7,
  experimental: 0.5
};
function confidenceWeight(rule) {
  if (rule.status === "archived") return 0;
  const tier = TIER_FACTOR[rule.current_tier] ?? 0.6;
  return rule.confidence * tier;
}
function rerankByConfidence(matches) {
  return matches.map((m) => ({ ...m, score: m.score * confidenceWeight(m.rule) })).sort((a, b) => b.score - a.score);
}

// ../core/src/matcher/hard-negative-accumulator.ts
init_esm_shims();
var MAX_HARD_NEG = 20;
var WINDOW_MS = 24 * 3600 * 1e3;
var TRIGGER_KINDS = /* @__PURE__ */ new Set([
  "ai.override.ignored",
  "ai.override.blocked_circumvented",
  "user.supportive_negation",
  "git.revert.related"
]);
async function accumulateHardNegative(args) {
  if (!TRIGGER_KINDS.has(args.event.kind)) return;
  if (args.now.getTime() - Date.parse(args.event.timestamp) > WINDOW_MS) return;
  const rule = args.store.getById(args.event.knowledge_id);
  if (!rule) return;
  const contextText = String(args.event.payload?.contextText ?? "");
  const [ctxVec] = await args.embedder.embed([contextText || " "]);
  if (!ctxVec) return;
  const existing = (() => {
    try {
      if (Array.isArray(rule.hard_negatives)) return rule.hard_negatives;
      return rule.hard_negatives ? JSON.parse(String(rule.hard_negatives)) : [];
    } catch {
      return [];
    }
  })();
  existing.push(ctxVec);
  while (existing.length > MAX_HARD_NEG) existing.shift();
  args.store.update(args.event.knowledge_id, {
    hard_negatives: JSON.stringify(existing)
  });
}

// ../core/src/correction-detector/rule-based.ts
init_esm_shims();
var DENIAL_PATTERNS = [
  // 中文：高置信
  { re: /不对/, weight: 0.95 },
  { re: /错了/, weight: 0.95 },
  { re: /不行|有问题/, weight: 0.9 },
  { re: /不要/, weight: 0.95 },
  { re: /不用/, weight: 0.9 },
  { re: /别这样|别那样|别用|别这么/, weight: 0.95 },
  { re: /先别|先不要|不要直接|别直接/, weight: 0.9 },
  { re: /重来|重新/, weight: 0.9 },
  { re: /换[一个种]|换成|改用|改成/, weight: 0.9 },
  { re: /思路不对|方向不对/, weight: 0.95 },
  { re: /不该|不应该/, weight: 0.9 },
  { re: /不是(这个|这样|这么|要|让你)|而不是/, weight: 0.85 },
  { re: /应该先|先.+再/, weight: 0.8 },
  // 英文：整词
  { re: /\b(no|wrong|don't|shouldn't|not|never)\b/i, weight: 0.9 },
  { re: /\binstead\b/i, weight: 0.9 },
  { re: /\bthat'?s wrong\b/i, weight: 0.95 },
  { re: /\bnot what I (asked|wanted|meant)\b/i, weight: 0.9 },
  { re: /\b(use|try|pick|choose)\s+[@A-Za-z0-9][\w@./-]*\s+(instead of|not)\s+[@A-Za-z0-9][\w@./-]*/i, weight: 0.9 }
];
function hasMultipleFailures(turn) {
  const failed = turn.toolCalls.filter((tc) => tc.succeeded === false);
  return failed.length >= 1;
}
function isSystemInjectedMessage(text) {
  if (!text) return false;
  if (/Base directory for this skill:/i.test(text)) return true;
  if (/<system-reminder>/i.test(text)) return true;
  if (/<local-command-caveat>/i.test(text)) return true;
  if (/<command-(name|message|args)>/i.test(text)) return true;
  return false;
}
function isPoliteQuery(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length > 80) return false;
  if (!/[?？]\s*$/.test(trimmed)) return false;
  if (!/^(能|可以)/.test(trimmed)) return false;
  return true;
}
var ruleBasedCorrectionDetector = {
  detect(session) {
    const out = [];
    for (let i = 0; i < session.turns.length; i++) {
      const turn = session.turns[i];
      const prevTurn = i > 0 ? session.turns[i - 1] : void 0;
      if (isSystemInjectedMessage(turn.userMessage)) continue;
      const denial = !isPoliteQuery(turn.userMessage) ? matchDenial(turn.userMessage) : null;
      if (denial && prevTurn) {
        out.push(buildMoment(turn, prevTurn, "explicit_denial", denial.weight));
      }
      if (prevTurn && hasMultipleFailures(prevTurn)) {
        const already = out.find((m) => m.turnIndex === i);
        if (!already) {
          const userSpoke = turn.userMessage.trim().length > 0;
          const weight = userSpoke ? 0.85 : 0.7;
          out.push(buildMoment(turn, prevTurn, "multi_failure", weight));
        }
      }
      if (prevTurn && !out.find((m) => m.turnIndex === i)) {
        const override = detectOverride(prevTurn.assistantText, turn.userMessage);
        if (override) {
          out.push(buildMoment(turn, prevTurn, "suggestion_override", 0.8));
        }
      }
      const codeEdit = detectCodeEdit(turn);
      if (codeEdit && !out.find((m) => m.turnIndex === i)) {
        out.push(buildMoment(turn, prevTurn, "code_edit", 0.8));
      }
      if (prevTurn && !out.find((m) => m.turnIndex === i)) {
        const hasError = detectErrorInMessage(turn.userMessage);
        const prevHadToolUse = prevTurn.toolCalls.length > 0;
        if (hasError && prevHadToolUse) {
          out.push(buildMoment(turn, prevTurn, "multi_failure", 0.8));
        }
      }
    }
    out.sort((a, b) => a.turnIndex - b.turnIndex);
    return out;
  }
};
function matchDenial(text) {
  if (!text.trim()) return null;
  let maxWeight = 0;
  for (const p of DENIAL_PATTERNS) {
    if (p.re.test(text)) {
      if (p.weight > maxWeight) maxWeight = p.weight;
    }
  }
  return maxWeight > 0 ? { weight: maxWeight } : null;
}
function detectOverride(assistantText, userText) {
  if (!userText.trim()) return false;
  const toolName = "[@A-Za-z0-9][\\w@./-]{1,}";
  const userSpecifies = new RegExp(`(\u7528|\u6539\u7528|\u4E0A)\\s*${toolName}`).test(userText) || new RegExp(`${toolName}\\s*(\u66F4\u597D|\u8F7B\u91CF|\u7B80\u5355)`, "i").test(userText) || new RegExp(`instead of\\s+${toolName}`, "i").test(userText);
  if (!userSpecifies) return false;
  const userToolMatch = userText.match(/[@A-Za-z0-9][A-Za-z0-9@./-]{2,}/g);
  if (!userToolMatch) return false;
  const assistantSuggested = /推荐|建议|我用|我来用|install|add\s+[A-Za-z]|[A-Za-z][\w-]{2,}\s*是/i.test(
    assistantText
  );
  if (!assistantSuggested) return false;
  const assistantLower = assistantText.toLowerCase();
  const STOP = /* @__PURE__ */ new Set([
    "the",
    "and",
    "for",
    "but",
    "more",
    "less",
    "less"
  ]);
  for (const tool of userToolMatch) {
    if (tool.length < 3) continue;
    if (STOP.has(tool.toLowerCase())) continue;
    if (!assistantLower.includes(tool.toLowerCase())) return true;
  }
  return false;
}
var ERROR_PATTERNS = [
  /\bError\s*:/i,
  /\bException\s*:/i,
  /\bE[A-Z]{3,}\b/,
  // ENOENT, EACCES, EPERM, EBUSY, etc.
  /at\s+\S+\s*\(\S+:\d+:\d+\)/,
  // JS stack trace frame
  /Traceback \(most recent call last\)/,
  /SyntaxError|TypeError|ReferenceError|RangeError/,
  /FAILED|✗|✕/,
  // test failures
  /exit code [1-9]|exit status [1-9]/i,
  /报错|错误|异常|失败/
  // Chinese error keywords
];
function detectErrorInMessage(text) {
  if (!text.trim()) return false;
  for (const re of ERROR_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}
function detectCodeEdit(turn) {
  if (/我改了|我重写了|你看我改/i.test(turn.userMessage)) return true;
  for (const tc of turn.toolCalls) {
    if (tc.name !== "Edit") continue;
    const inp = tc.input;
    const oldStr = typeof inp.old_string === "string" ? inp.old_string : "";
    const newStr = typeof inp.new_string === "string" ? inp.new_string : "";
    if (newStr.length > oldStr.length * 2 && newStr.length > 200) return true;
  }
  return false;
}
function buildMoment(turn, prevTurn, signal, weight) {
  return {
    signal,
    weight,
    turnIndex: turn.turnIndex,
    correctionText: turn.userMessage,
    previousAssistantText: prevTurn?.assistantText ?? "",
    previousToolCalls: (prevTurn?.toolCalls ?? []).map(summarizeToolCall),
    timestamp: turn.timestamp
  };
}
function summarizeToolCall(tc) {
  const keys = Object.keys(tc.input).slice(0, 3);
  const head = `${tc.name}(${keys.join(",")})`;
  const inputPreview = summarizeToolInput(tc.input);
  if (tc.succeeded === false) {
    const err = typeof tc.result === "string" ? tc.result.trim().slice(0, 200) : "";
    const body = [inputPreview, err].filter(Boolean).join(" | ");
    return body ? `${head} \u2717 ${body}` : `${head} \u2717 FAILED`;
  }
  return inputPreview ? `${head}: ${inputPreview}` : head;
}
function summarizeToolInput(input) {
  const parts = [];
  for (const key of [
    "command",
    "file_path",
    "url",
    "content",
    "old_string",
    "new_string",
    "pattern",
    "query"
  ]) {
    const v = input[key];
    if (typeof v !== "string" || !v.trim()) continue;
    parts.push(`${key}=${truncateOneLine(v, 180)}`);
    if (parts.join(" | ").length > 360) break;
  }
  return parts.join(" | ");
}
function truncateOneLine(s, max) {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "\u2026";
}

// ../core/src/success-detector/rule-based.ts
init_esm_shims();
var PRAISE_PATTERNS = [
  /完美|就是这样|就这样|很好|赞|不错|太棒|搞定|👍|挺好/,
  /\b(perfect|great|nice|excellent|exactly|works?|lgtm|awesome)\b/i
];
var DENIAL_PATTERNS2 = [
  /不对|错了|不行|有问题|不要|不用|别这样|别那样|别用|别这么|先别|先不要|不要直接|别直接|思路不对|方向不对|换[一个种]|换成|改用|改成|重来|重新|不该|不应该|不是(这个|这样|这么|要|让你)|而不是|应该先|先.+再/,
  /\b(no|wrong|don't|shouldn't|not|never|instead|that'?s wrong|not what I (asked|wanted|meant))\b/i,
  /\b(use|try|pick|choose)\s+[@A-Za-z0-9][\w@./-]*\s+(instead of|not)\s+[@A-Za-z0-9][\w@./-]*/i
];
var PRODUCTIVE_TOOLS = /* @__PURE__ */ new Set([
  "Write",
  "Edit",
  "NotebookEdit",
  "Bash",
  "WebFetch"
]);
function isDenial(text) {
  return DENIAL_PATTERNS2.some((p) => p.test(text));
}
function isPraise(text) {
  return PRAISE_PATTERNS.some((p) => p.test(text));
}
function categorizeToolCall(tc) {
  const input = tc.input;
  const fp = typeof input.file_path === "string" ? input.file_path : "";
  const ext = fp.match(/\.(\w+)$/)?.[1] ?? "-";
  return `${tc.name}:${ext}`;
}
function hasProductiveToolCall(turn) {
  return turn.toolCalls.some((tc) => PRODUCTIVE_TOOLS.has(tc.name));
}
function allToolsSucceeded(turn) {
  return turn.toolCalls.every(
    (tc) => !PRODUCTIVE_TOOLS.has(tc.name) || tc.succeeded !== false
  );
}
var ruleBasedSuccessDetector = {
  detect(session) {
    const out = [];
    const corrections = ruleBasedCorrectionDetector.detect(session);
    const correctedTurns = /* @__PURE__ */ new Set();
    for (const c of corrections) {
      if (c.turnIndex > 0) correctedTurns.add(c.turnIndex - 1);
    }
    for (let i = 1; i < session.turns.length; i++) {
      if (isDenial(session.turns[i].userMessage)) {
        correctedTurns.add(i - 1);
      }
    }
    for (let i = 1; i < session.turns.length; i++) {
      const turn = session.turns[i];
      if (isPraise(turn.userMessage) && !isDenial(turn.userMessage)) {
        const prev = session.turns[i - 1];
        out.push({
          signal: "explicit_praise",
          weight: 0.8,
          turnIndex: i,
          assistantText: prev?.assistantText ?? "",
          toolCalls: (prev?.toolCalls ?? []).map(summarizeToolCall2),
          timestamp: turn.timestamp
        });
      }
    }
    const patternCount = /* @__PURE__ */ new Map();
    for (const turn of session.turns) {
      if (correctedTurns.has(turn.turnIndex)) continue;
      if (!allToolsSucceeded(turn)) continue;
      const seenInTurn = /* @__PURE__ */ new Set();
      for (const tc of turn.toolCalls) {
        if (!PRODUCTIVE_TOOLS.has(tc.name)) continue;
        const cat = categorizeToolCall(tc);
        if (seenInTurn.has(cat)) continue;
        seenInTurn.add(cat);
        if (!patternCount.has(cat)) patternCount.set(cat, []);
        patternCount.get(cat).push(turn.turnIndex);
      }
    }
    const repeatedTurns = /* @__PURE__ */ new Set();
    for (const [cat, turnIndices] of patternCount.entries()) {
      if (turnIndices.length < 3) continue;
      for (const ti of turnIndices) repeatedTurns.add(ti);
      out.push({
        signal: "repeated_pattern",
        weight: 0.6,
        turnIndex: turnIndices[0],
        assistantText: session.turns[turnIndices[0]]?.assistantText ?? "",
        toolCalls: [cat + ` \xD7 ${turnIndices.length}`],
        timestamp: session.turns[turnIndices[0]]?.timestamp ?? ""
      });
    }
    for (let i = 0; i < session.turns.length; i++) {
      const turn = session.turns[i];
      const next = session.turns[i + 1];
      if (!next) continue;
      if (!hasProductiveToolCall(turn)) continue;
      if (!allToolsSucceeded(turn)) continue;
      if (correctedTurns.has(i)) continue;
      if (repeatedTurns.has(i)) continue;
      if (isDenial(next.userMessage)) continue;
      if (isPraise(next.userMessage)) continue;
      out.push({
        signal: "one_shot_success",
        weight: 0.3,
        turnIndex: i,
        assistantText: turn.assistantText,
        toolCalls: turn.toolCalls.map(summarizeToolCall2),
        timestamp: turn.timestamp
      });
    }
    out.sort((a, b) => a.turnIndex - b.turnIndex);
    return out;
  }
};
function summarizeToolCall2(tc) {
  const keys = Object.keys(tc.input).slice(0, 3);
  return `${tc.name}(${keys.join(",")})`;
}

// ../core/src/session-parser/index.ts
init_esm_shims();
function extractUserText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const b of content) {
    if (!b || typeof b !== "object") continue;
    const block = b;
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}
function extractToolResults(content) {
  if (!Array.isArray(content)) return [];
  const out = [];
  for (const b of content) {
    if (!b || typeof b !== "object") continue;
    const block = b;
    if (block.type !== "tool_result") continue;
    if (typeof block.tool_use_id !== "string") continue;
    const c = String(block.content ?? "");
    out.push({
      id: block.tool_use_id,
      payload: {
        content: c,
        // B-052: added errno to catch Node.js system error objects like {"errno":-13}
        // Note: closing \b omitted because err! ends in a non-word char and would break matching.
        succeeded: !/\b(error|err!|failed|not found|exit code [1-9]|errno)/i.test(c)
      }
    });
  }
  return out;
}
function hasUserText(content) {
  return extractUserText(content).trim().length > 0;
}
function parseSessionFile(raw) {
  const messages = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  const toolResults = /* @__PURE__ */ new Map();
  for (const m of messages) {
    if (!m.message) continue;
    const blocks = m.message.content;
    for (const r of extractToolResults(blocks)) {
      toolResults.set(r.id, r.payload);
    }
  }
  const turns = [];
  let currentTurn = null;
  let sessionId = "unknown";
  const applyToolResultsToTurn = (turn, content) => {
    if (!turn) return;
    const results = extractToolResults(content);
    for (const r of results) {
      const tc = findToolCallById(turns, turn, r.id);
      if (tc) {
        tc.result = r.payload.content;
        tc.succeeded = r.payload.succeeded;
      }
    }
  };
  for (const m of messages) {
    if (m.sessionId) sessionId = m.sessionId;
    if (m.type === "user" && m.message) {
      const content = m.message.content;
      if (hasUserText(content)) {
        if (currentTurn) turns.push(currentTurn);
        currentTurn = {
          turnIndex: turns.length,
          userMessage: extractUserText(content),
          assistantText: "",
          toolCalls: [],
          timestamp: m.timestamp ?? ""
        };
      } else {
        applyToolResultsToTurn(currentTurn, content);
      }
    } else if (m.type === "assistant" && m.message) {
      if (!currentTurn) continue;
      const blocks = m.message.content;
      if (!Array.isArray(blocks)) continue;
      for (const b of blocks) {
        if (b.type === "text") {
          if (currentTurn.assistantText) currentTurn.assistantText += "\n";
          currentTurn.assistantText += b.text;
        } else if (b.type === "tool_use") {
          const tc = {
            id: b.id,
            name: b.name,
            input: b.input
          };
          const tr = toolResults.get(b.id);
          if (tr) {
            tc.result = tr.content;
            tc.succeeded = tr.succeeded;
          }
          currentTurn.toolCalls.push(tc);
        } else if (b.type === "tool_result") {
          const r = { id: b.tool_use_id, payload: toolResults.get(b.tool_use_id) };
          if (r.payload) {
            const tc = findToolCallById(turns, currentTurn, r.id);
            if (tc) {
              tc.result = r.payload.content;
              tc.succeeded = r.payload.succeeded;
            }
          }
        }
      }
    }
  }
  if (currentTurn) turns.push(currentTurn);
  return {
    sessionId,
    turns,
    startTime: turns[0]?.timestamp ?? "",
    endTime: turns[turns.length - 1]?.timestamp ?? ""
  };
}
function findToolCallById(allPriorTurns, current, id) {
  for (const tc of current.toolCalls) if (tc.id === id) return tc;
  for (let i = allPriorTurns.length - 1; i >= 0; i--) {
    const t = allPriorTurns[i];
    for (const tc of t.toolCalls) if (tc.id === id) return tc;
  }
  return void 0;
}

// ../core/src/extractor/prompt.ts
init_esm_shims();
function buildExtractionPrompt(input) {
  const header = buildHeader(input.kind);
  const contextBlock = buildContextBlock(input);
  const schema = SCHEMA_BLOCK;
  const examples = EXAMPLES_BLOCK;
  const instructions = INSTRUCTIONS_BLOCK;
  return [header, contextBlock, schema, examples, instructions].join("\n\n");
}
function buildHeader(kind) {
  const sourceMap = {
    correction: "\u7528\u6237\u5728 Claude Code \u4F1A\u8BDD\u4E2D\u7EA0\u6B63\u4E86 AI \u7684\u884C\u4E3A",
    success: "\u7528\u6237\u7684\u4E00\u6B21\u6210\u529F\u6A21\u5F0F\uFF08AI \u672A\u88AB\u7EA0\u6B63\u4E14\u6A21\u5F0F\u88AB\u91CD\u590D\u4F7F\u7528\uFF09",
    "rule-text": "\u4E00\u6BB5\u5DF2\u6709\u7684\u89C4\u5219\u6587\u672C",
    insights: "Claude Code /insights \u62A5\u544A",
    "npm-audit": "npm audit \u8F93\u51FA\uFF08\u4F9D\u8D56\u5B89\u5168\u6F0F\u6D1E\uFF09",
    "pr-review": "PR review \u8BC4\u8BBA",
    "git-hotspot": "git log \u70ED\u70B9\u6587\u4EF6\uFF08\u9891\u7E41\u88AB\u4FEE\u6539\u7684\u8DEF\u5F84\uFF09",
    "ci-failure": "CI failure \u65E5\u5FD7\u7247\u6BB5"
  };
  const source = sourceMap[kind];
  return `\u4F60\u662F\u77E5\u8BC6\u63D0\u53D6\u5668\u3002\u4EFB\u52A1\u662F\u628A\u4E0B\u9762\u8FD9\u6BB5\u4E0A\u4E0B\u6587\uFF08${source}\uFF09\u63D0\u70BC\u6210\u4E00\u6761\u7ED3\u6784\u5316\u7684"\u77E5\u8BC6\u6761\u76EE"\uFF0C\u4F9B\u56E2\u961F AI \u672A\u6765\u53C2\u8003\u3002`;
}
function buildContextBlock(input) {
  return [
    "\u3010\u4E0A\u4E0B\u6587\u3011",
    `\u4FE1\u53F7\u6743\u91CD: ${input.weight.toFixed(2)}`,
    "```",
    input.context.trim(),
    "```"
  ].join("\n");
}
var SCHEMA_BLOCK = `\u3010\u8F93\u51FA\u5B57\u6BB5\u3011
- category: "C" | "E" | "S" | "K"
  - C \u4EE3\u7801\u5C42\uFF08\u8BED\u6CD5\u3001\u7C7B\u578B\u3001API \u7528\u6CD5\uFF09
  - E \u5DE5\u7A0B\u5C42\uFF08\u67B6\u6784\u3001\u4F9D\u8D56\u3001\u5DE5\u5177\u94FE\uFF09
  - S \u7B56\u7565\u5C42\uFF08\u4EFB\u52A1\u5206\u89E3\u3001\u5B9E\u73B0\u987A\u5E8F\u3001\u53D6\u820D\uFF09
  - K \u8BA4\u77E5\u5C42\uFF08\u7528\u6237\u504F\u597D\u3001\u5FC3\u667A\u6A21\u578B\u3001\u534F\u4F5C\u65B9\u5F0F\uFF09
- tags: string[]  \u81EA\u7531\u6807\u7B7E\uFF0C2-5 \u4E2A\u77ED\u8BCD\uFF1B\u82F1\u6587\u6216\u4E2D\u6587\u5747\u53EF\uFF08\u5982 "http-client" "architecture"\uFF09
- type: "avoidance" | "practice"
  - avoidance \u907F\u5751\uFF08"\u4E0D\u8981 X"\uFF09\u2014\u2014**\u5FC5\u987B**\u6709\u53EF\u5B57\u9762\u5339\u914D\u7684 wrong_pattern \u5173\u952E\u8BCD
  - practice \u6700\u4F73\u5B9E\u8DF5\uFF08"\u5C31\u8BE5 X"\uFF09\u2014\u2014wrong_pattern **\u5FC5\u987B\u7559\u7A7A**
  \u26A0\uFE0F \u82E5\u6709\u53EF\u5B57\u9762\u5339\u914D\u7684\u53CD\u6A21\u5F0F\uFF0C\u4E00\u5F8B\u9009 avoidance\u3002\u4E25\u7981 practice + wrong_pattern \u7EC4\u5408\uFF0C
      \u5426\u5219 validator L0 \u4F1A\u62D2\u6536 (practice_must_not_have_wrong_pattern /
      avoidance_must_have_wrong_pattern)\u3002
- nature: "objective" | "subjective"
  - objective \u5BA2\u89C2\u53EF\u9A8C\u8BC1\uFF08\u8BED\u6CD5\u9519\u8BEF\u3001API \u884C\u4E3A\uFF09
  - subjective \u4E3B\u89C2\u504F\u597D\uFF08\u67B6\u6784\u9009\u578B\u3001\u98CE\u683C\uFF09
- trigger: string  \u4F55\u65F6\u8FD9\u6761\u77E5\u8BC6\u751F\u6548\u3002\u4E00\u53E5\u8BDD\uFF0C\u63CF\u8FF0\u573A\u666F\uFF0C\u4E0D\u5305\u542B\u5177\u4F53\u505A\u6CD5
- wrong_pattern: string  **\u5173\u952E\u89C4\u5219**\u2014\u2014**\u53EF\u5B57\u9762 substring \u5339\u914D**\u7684\u901A\u7528\u5173\u952E\u8BCD\u3002
  **\u5143\u539F\u5219** (3 \u6761\u5FC5\u987B\u5168\u4E2D)\uFF1A
    (a) \u5B57\u9762\u7A33\u5B9A \u2014\u2014 \u8DE8\u9879\u76EE\u8DE8\u56E2\u961F\uFF0C\u8FD9\u4E32\u5B57\u7B26\u542B\u4E49\u76F8\u540C
    (b) \u53EF substring \u547D\u4E2D \u2014\u2014 \u5728\u4EE3\u7801/\u547D\u4EE4/\u914D\u7F6E\u6587\u672C\u91CC\u4F1A\u539F\u6837\u51FA\u73B0
    (c) \u8131\u79BB\u4E0A\u4E0B\u6587\u4ECD\u6307\u5411\u95EE\u9898 \u2014\u2014 \u770B\u5230\u8FD9\u4E32\u5B57\u7B26\u5C31\u77E5\u9053\u8E29\u5751\uFF0C\u4E0D\u5FC5\u61C2\u5468\u56F4\u542B\u4E49
  **\u5141\u8BB8\u7684 18 \u7C7B**\uFF08A \u4EE3\u7801/\u8BED\u8A00\u3001B \u57FA\u7840\u8BBE\u65BD/\u547D\u4EE4\u3001C \u914D\u7F6E/\u73AF\u5883\u3001D \u6570\u636E/\u67E5\u8BE2\u3001E \u5B89\u5168/\u8D28\u91CF\uFF09\uFF1A
    A1 \u4F9D\u8D56/\u5305/\u6A21\u5757\u540D\uFF1A\`moment\` \`jQuery\` \`@reduxjs/toolkit\` \`lodash\` \`request\`
    A2 API/\u65B9\u6CD5/\u5C5E\u6027\uFF1A \`localStorage.getItem\` \`document.write\` \`eval(\` \`innerHTML =\` \`XMLHttpRequest\`
    A3 \u8BED\u6CD5/\u5173\u952E\u5B57\uFF1A   \`var \` \`== \` \`!= \` \`new Function(\` \`with (\`
    A4 \u7C7B\u578B\u7CFB\u7EDF\u6807\u8BB0\uFF1A  \`as any\` \`: any\` \`@ts-ignore\` \`@ts-nocheck\` \`Record<string, any>\`
    A5 \u6846\u67B6\u53CD\u6A21\u5F0F\uFF1A    \`dangerouslySetInnerHTML\` \`key={index}\` \`v-html\` \`ng-bind-html\`
    B1 Git\uFF1A           \`git push --force\` \`git commit --no-verify\` \`git reset --hard\`
    B2 \u5305\u7BA1\u7406\uFF1A        \`npm install -g\` \`pip install --user\` \`:latest\`
    B3 Shell \u5371\u9669\uFF1A    \`rm -rf /\` \`chmod 777\` \`chmod -R 777\` \`sudo rm\` \`umask 000\` \`eval $\`
    B4 Docker\uFF1A        \`FROM .*:latest\` (\u5B57\u9762 \`:latest\`) \`USER root\` \`privileged: true\` \`--cap-add=ALL\`
    B5 Kubernetes\uFF1A    \`hostNetwork: true\` \`runAsUser: 0\` \`hostPath:\` \`privileged: true\`
    C1 \u914D\u7F6E\u952E\uFF1A        \`allowJs\` \`strict: false\` \`noImplicitAny: false\` \`skipLibCheck: true\`
    C2 \u73AF\u5883\u53D8\u91CF\uFF1A      \`NODE_ENV=development\` \`DEBUG=*\` \`DISABLE_AUTH=\`
    C3 URL/\u7F51\u7EDC\uFF1A      \`http://\` (\u660E\u6587) \`localhost:\` \`0.0.0.0/0\` \u786C\u7F16\u7801 IP
    D1 SQL \u53CD\u6A21\u5F0F\uFF1A    \`SELECT *\` \`DROP TABLE\` \`DELETE FROM \` (\u65E0 WHERE) \`OR 1=1\` \`TRUNCATE \`
    D2 \u6B63\u5219\u98CE\u9669\uFF1A      \`.*.*.*\` (\u8FDE\u7EED\u901A\u914D) \`(.+)+\` (\u56DE\u6EAF\u70B8\u5F39)
    E1 \u51ED\u8BC1/\u5BC6\u94A5\u524D\u7F00\uFF1A \`AKIA\` (AWS) \`ghp_\` (GitHub PAT) \`sk_live_\` (Stripe) \`SG.\` (SendGrid)
    E2 XSS/\u53CD\u5E8F\u5217\u5316\uFF1A  \`innerHTML =\` \`document.write(\` \`eval(\` \`new Function(\` \`javascript:\` \`pickle.loads(\`
    E3 \u6D4B\u8BD5/\u65E5\u5FD7\u6B8B\u7559\uFF1A \`.only(\` \`.skip(\` \`xdescribe(\` \`fdescribe(\` \`console.log(\` (prod) \`print(\` (prod)
  \u591A\u4E2A\u5019\u9009\u7528 \`|\` \u5206\u9694\uFF0C\u6BCF\u6BB5 \u22653 \u5B57\u7B26\uFF0C\u226440 \u5B57\u7B26\u3002
  **\u56DB\u6761\u94C1\u5F8B**\uFF1A
    1. \u6700\u957F\u516C\u5171\u7247\u6BB5 \u2014\u2014 \u5B81\u8981 \`npm install\` \u4E00\u4E2A\u77ED\u8BCD\uFF0C\u4E0D\u8981 \`npm install --save moment^2.29\` \u5B8C\u6574\u884C
    2. pipe \u5206\u591A variant \u2014\u2014 \u540C\u6982\u5FF5\u591A\u5199\u6CD5 \`innerHTML =|innerHTML+=\`
    3. \u907F\u514D\u8FC7\u5EA6\u901A\u7528 token \u2014\u2014 \u7981 \`if\`/\`for\`/\`function\`/\`return\`/\`log(\`\uFF08\u5355\u72EC\uFF09
    4. \u4E0D\u5199\u6B63\u5219 \u2014\u2014 matcher \u53EA\u505A substring\uFF0C\`\\d+\` \u4E0D\u751F\u6548\uFF0C\u7528\u6700\u957F\u5B57\u9762\u524D\u7F00
  **\u7981\u6B62**\uFF1A
    \u274C \u6574\u53E5\u81EA\u7136\u8BED\u8A00\uFF08"demote=0 \u65F6..." "AI \u6CA1\u5148\u67E5..."\uFF09
    \u274C \u9879\u76EE\u4E13\u5C5E\u8DEF\u5F84/\u51FD\u6570\uFF08\`packages/...\`\u3001\`@teamagent/...\`\u3001\`tierFromDemerit\`\uFF09
    \u274C \u62BD\u8C61\u52A8\u4F5C\u63CF\u8FF0\uFF08"\u76F4\u63A5 emit \u65B0 source \u503C"\uFF09
    \u274C \u8D85\u957F\u5B57\u9762\u91CF\uFF08>40 \u5B57\u7B26\u4E00\u822C\u592A\u5177\u4F53\uFF09
    \u274C \u6D4B\u8BD5\u4EE3\u7801\u7247\u6BB5\uFF08\`tierFromDemerit(4, 'stable')\`\uFF09
  \u627E\u4E0D\u5230\u901A\u7528\u5173\u952E\u8BCD\u65F6\uFF0Ctype \u6539 "practice" \u5E76\u7559\u7A7A wrong_pattern\u2014\u2014\u800C\u975E\u786C\u7F16\u5165\u5177\u4F53\u5B57\u9762\u91CF\u3002
- correct_pattern: string  \u6B63\u786E\u505A\u6CD5\u7684\u5173\u952E\u5B57/\u53E5\u5F0F\u6216\u4E00\u53E5\u8BDD\u5EFA\u8BAE
- reasoning: string  \u4E00\u53E5\u8BDD\u89E3\u91CA\u4E3A\u4EC0\u4E48\u3002\u5305\u542B"\u4E3A\u4EC0\u4E48\u9519"\u548C"\u4E3A\u4EC0\u4E48\u5BF9"`;
var EXAMPLES_BLOCK = `\u3010\u793A\u4F8B\u3011
\u793A\u4F8B\u8F93\u5165\uFF1A\u7528\u6237\u8BF4 "\u4E0D\u7528 axios\uFF0C\u7528 fetch\uFF0C\u9879\u76EE\u8981\u96F6\u4F9D\u8D56"\uFF0CAI \u4E4B\u524D\u5EFA\u8BAE axios\u3002
\u793A\u4F8B\u8F93\u51FA\uFF1A
\`\`\`json
{
  "category": "E",
  "tags": ["http-client", "dependency", "tech-choice"],
  "type": "avoidance",
  "nature": "subjective",
  "trigger": "\u9700\u8981\u53D1\u8D77 HTTP \u8BF7\u6C42",
  "wrong_pattern": "axios",
  "correct_pattern": "fetch",
  "reasoning": "\u9879\u76EE\u504F\u597D\u96F6\u4F9D\u8D56\uFF0Cfetch \u5728 Node 18+ \u539F\u751F\u53EF\u7528\uFF0C\u65E0\u9700\u989D\u5916\u5305"
}
\`\`\`

\u793A\u4F8B\u8F93\u5165\uFF1A\u7528\u6237\u8BF4 "\u8FD9\u601D\u8DEF\u4E0D\u5BF9\uFF0C\u5148\u5199\u6D4B\u8BD5\u518D\u5199\u5B9E\u73B0"\uFF0CAI \u76F4\u63A5\u5F00\u59CB\u5199\u5B9E\u73B0\u4EE3\u7801\u3002
\u793A\u4F8B\u8F93\u51FA\uFF1A
\`\`\`json
{
  "category": "S",
  "tags": ["tdd", "workflow"],
  "type": "practice",
  "nature": "subjective",
  "trigger": "\u5F00\u59CB\u5B9E\u73B0\u65B0\u529F\u80FD\u524D",
  "wrong_pattern": "",
  "correct_pattern": "\u5148\u5199\u5931\u8D25\u6D4B\u8BD5\u518D\u5199\u5B9E\u73B0\uFF08TDD\uFF09",
  "reasoning": "\u56E2\u961F\u91C7\u7528 TDD \u8282\u594F\uFF1A\u7EA2\u2192\u7EFF\u2192\u91CD\u6784\uFF0C\u80FD\u51CF\u5C11\u56DE\u5F52\u5E76\u5F3A\u5236\u63A5\u53E3\u5148\u884C"
}
\`\`\`

\u793A\u4F8B\u8F93\u5165\uFF1A\u7528\u6237\u8BF4 "\u4E0D\u5BF9" \u4F46\u6CA1\u7ED9\u66FF\u4EE3\u65B9\u6848\uFF0C\u4E0A\u4E0B\u6587\u4E5F\u770B\u4E0D\u51FA\u539F\u56E0\u3002
\u793A\u4F8B\u8F93\u51FA\uFF1A
\`\`\`json
null
\`\`\`

\u3010\u53CD\u4F8B\u2014\u2014\u4E0D\u8981\u8FD9\u6837\u505A\u3011
\u274C \u9519\u8BEF\uFF1Awrong_pattern = "AI \u76F4\u63A5\u8DD1 npm install moment, \u6CA1\u5148\u67E5\u9879\u76EE\u6709\u6CA1\u6709\u7528\u522B\u7684\u65F6\u95F4\u5E93"
\u2705 \u6B63\u786E\uFF1Awrong_pattern = "moment"   \uFF08\u53EA\u8981\u5E93\u540D\u672C\u8EAB\uFF0C\u6574\u53E5\u63CF\u8FF0\u8FDB reasoning\uFF09

\u274C \u9519\u8BEF\uFF1Awrong_pattern = "\u76F4\u63A5\u5728 pipeline \u91CC emit \u65B0 source \u503C"
\u2705 \u6B63\u786E\uFF1Atype \u6539 "practice"\uFF0Cwrong_pattern \u7559\u7A7A    \uFF08\u627E\u4E0D\u5230\u901A\u7528\u5173\u952E\u8BCD\u65F6\u522B\u786C\u5199\uFF09

\u274C \u9519\u8BEF\uFF1Awrong_pattern = "packages/core/src/scorer.ts \u672A\u5224\u7A7A"
\u2705 \u6B63\u786E\uFF1Awrong_pattern = ""\uFF08\u9879\u76EE\u5185\u90E8\u8DEF\u5F84\u65E0\u666E\u9002\u4EF7\u503C\uFF0Ctype="practice"\uFF09`;
var INSTRUCTIONS_BLOCK = `\u3010\u4E25\u683C\u8981\u6C42\u3011
1. \u53EA\u8F93\u51FA**\u4E00\u6BB5** JSON\uFF08\u5728 \`\`\`json fenced block \u91CC\uFF09\u6216\u5B57\u9762\u91CF \`null\`
2. \u4E0D\u8981\u5728 JSON \u524D\u540E\u6DFB\u52A0\u4EFB\u4F55\u89E3\u91CA\u6587\u5B57
3. \u5982\u679C\u4E0A\u4E0B\u6587\u4FE1\u606F\u4E0D\u8DB3\u4EE5\u63D0\u53D6\u51FA\u6709\u7528\u7684\u77E5\u8BC6\uFF08\u4F8B\u5982\u7528\u6237\u53EA\u8BF4"\u4E0D\u5BF9"\u4F46\u6CA1\u7ED9\u66FF\u4EE3\u3001\u6216\u7EA0\u6B63\u5185\u5BB9\u592A\u79C1\u4EBA\u5316\uFF09\uFF0C\u8F93\u51FA \`null\`
4. trigger \u8981\u5199\u5F97\u901A\u7528\u4E00\u4E9B\uFF0C\u8BA9\u672A\u6765\u4E0D\u540C\u4EFB\u52A1\u91CC\u90FD\u80FD\u5339\u914D\uFF1B\u4E0D\u8981\u628A\u5177\u4F53\u5B9E\u73B0\u7EC6\u8282\u5199\u8FDB trigger
5. wrong_pattern \u5FC5\u987B\u662F**\u53EF\u8DE8\u9879\u76EE\u590D\u7528**\u7684\u5E93\u540D/API \u7B26\u53F7/\u547D\u4EE4/\u914D\u7F6E\u952E\u540D\u3002\u6574\u53E5\u63CF\u8FF0\u3001\u9879\u76EE\u5185\u90E8\u8DEF\u5F84\u3001\u62BD\u8C61\u52A8\u4F5C\u63CF\u8FF0\u4E00\u5F8B\u4E0D\u63A5\u53D7\u2014\u2014\u627E\u4E0D\u5230\u65F6\u5C31\u6539 type="practice" \u7559\u7A7A`;
function buildRetrofitPrompt(input) {
  return [
    "\u4F60\u5728\u6539\u9020\u4E00\u6761\u65E7\u77E5\u8BC6\u6761\u76EE\u7684 wrong_pattern \u5B57\u6BB5\u3002",
    "\u539F\u5B57\u6BB5\u662F\u4E0A\u4E00\u7248 LLM \u63D0\u53D6\u65F6\u6284\u8FDB\u53BB\u7684\u539F\u59CB\u4F1A\u8BDD\u7247\u6BB5\uFF0C\u73B0\u5728\u8981\u538B\u6210**\u53EF\u8DE8\u9879\u76EE\u590D\u7528**\u7684\u901A\u7528\u5173\u952E\u8BCD\u3002",
    "",
    "\u3010\u539F\u89C4\u5219\u3011",
    `trigger:         ${input.trigger}`,
    `wrong_pattern:   ${input.wrong_pattern}`,
    `correct_pattern: ${input.correct_pattern}`,
    `reasoning:       ${input.reasoning}`,
    input.tags?.length ? `tags:            ${input.tags.join(", ")}` : "",
    "",
    "\u3010\u4F60\u8981\u505A\u7684\u3011",
    "\u4ECE\u4E0A\u9762 4 \u4E2A\u5B57\u6BB5\u91CC\u62BD\u51FA**\u53EF substring \u5339\u914D**\u7684\u901A\u7528\u5173\u952E\u8BCD\u3002",
    "",
    "\u3010\u5143\u539F\u5219\u3011 (3 \u6761\u5FC5\u987B\u5168\u4E2D)",
    "(a) \u5B57\u9762\u7A33\u5B9A \u2014\u2014 \u8DE8\u9879\u76EE\u8DE8\u56E2\u961F\uFF0C\u8FD9\u4E32\u5B57\u7B26\u542B\u4E49\u76F8\u540C",
    "(b) \u53EF substring \u547D\u4E2D \u2014\u2014 \u5728\u4EE3\u7801/\u547D\u4EE4/\u914D\u7F6E\u6587\u672C\u91CC\u4F1A\u539F\u6837\u51FA\u73B0",
    "(c) \u8131\u79BB\u4E0A\u4E0B\u6587\u4ECD\u6307\u5411\u95EE\u9898 \u2014\u2014 \u770B\u5230\u5C31\u77E5\u9053\u8E29\u5751\uFF0C\u4E0D\u5FC5\u61C2\u5468\u56F4\u542B\u4E49",
    "",
    "\u3010\u5141\u8BB8\u7684 18 \u7C7B\u3011",
    "A. \u4EE3\u7801/\u8BED\u8A00:",
    "  A1 \u4F9D\u8D56/\u5305/\u6A21\u5757\u540D (moment, jQuery, @reduxjs/toolkit, lodash)",
    "  A2 API/\u65B9\u6CD5/\u5C5E\u6027 (localStorage.getItem, document.write, eval(, innerHTML =)",
    "  A3 \u8BED\u6CD5/\u5173\u952E\u5B57   (var [\u5E26\u7A7A\u683C], == , != , new Function(, with ()",
    "  A4 \u7C7B\u578B\u7CFB\u7EDF      (as any, : any, @ts-ignore, @ts-nocheck, Record<string, any>)",
    "  A5 \u6846\u67B6\u53CD\u6A21\u5F0F    (dangerouslySetInnerHTML, key={index}, v-html)",
    "B. \u57FA\u7840\u8BBE\u65BD/\u547D\u4EE4:",
    "  B1 Git           (git push --force, git commit --no-verify, git reset --hard)",
    "  B2 \u5305\u7BA1\u7406        (npm install -g, pip install --user, :latest)",
    "  B3 Shell \u5371\u9669    (rm -rf /, chmod 777, sudo rm, umask 000, eval $)",
    "  B4 Docker        (`:latest` [\u5B57\u9762], USER root, privileged: true, --cap-add=ALL)",
    "  B5 Kubernetes    (hostNetwork: true, runAsUser: 0, hostPath:)",
    "C. \u914D\u7F6E/\u73AF\u5883:",
    "  C1 \u914D\u7F6E\u952E        (allowJs, strict: false, noImplicitAny: false)",
    "  C2 \u73AF\u5883\u53D8\u91CF      (NODE_ENV=development, DEBUG=*, DISABLE_AUTH=)",
    "  C3 URL/\u7F51\u7EDC      (http://, localhost:, 0.0.0.0/0)",
    "D. \u6570\u636E/\u67E5\u8BE2:",
    "  D1 SQL \u53CD\u6A21\u5F0F    (SELECT *, DROP TABLE, DELETE FROM [\u65E0 WHERE], OR 1=1)",
    "  D2 \u6B63\u5219\u98CE\u9669      (.*.*.*, (.+)+ \u56DE\u6EAF\u70B8\u5F39)",
    "E. \u5B89\u5168/\u8D28\u91CF:",
    "  E1 \u51ED\u8BC1\u524D\u7F00      (AKIA, ghp_, sk_live_, SG.)",
    "  E2 XSS/\u53CD\u5E8F\u5217\u5316  (innerHTML =, document.write(, eval(, new Function(, javascript:)",
    "  E3 \u6D4B\u8BD5/\u65E5\u5FD7\u6B8B\u7559 (.only(, .skip(, xdescribe(, console.log(, print()",
    "",
    "\u591A\u4E2A\u5019\u9009\u7528 `|` \u5206\u9694\u3002\u6BCF\u6BB5 \u22653 \u5B57\u7B26\uFF0C\u226440 \u5B57\u7B26\u3002",
    "",
    "\u3010\u56DB\u6761\u94C1\u5F8B\u3011",
    "1. \u6700\u957F\u516C\u5171\u7247\u6BB5 \u2014\u2014 \u5B81\u8981 `npm install` \u4E00\u4E2A\u77ED\u8BCD\uFF0C\u4E0D\u8981 `npm install --save moment^2.29`",
    "2. pipe \u5206\u591A variant \u2014\u2014 \u540C\u6982\u5FF5\u591A\u5199\u6CD5 `innerHTML =|innerHTML+=`",
    "3. \u907F\u514D\u8FC7\u5EA6\u901A\u7528 \u2014\u2014 \u7981 `if`/`for`/`return`/`log(` \u5355\u72EC\u51FA\u73B0",
    "4. \u4E0D\u5199\u6B63\u5219 \u2014\u2014 matcher \u53EA\u505A substring, `\\d+` \u4E0D\u751F\u6548, \u7528\u5B57\u9762\u524D\u7F00",
    "",
    "\u3010\u7981\u6B62\u3011",
    "\u274C \u6574\u53E5\u81EA\u7136\u8BED\u8A00 ('demote=0 \u65F6\u8FD4\u56DE currentTier', 'AI \u6CA1\u5148\u67E5...')",
    "\u274C \u9879\u76EE\u5185\u90E8\u8DEF\u5F84 (packages/..., @teamagent/..., src/...)",
    "\u274C \u9879\u76EE\u5185\u90E8\u51FD\u6570/\u53D8\u91CF (tierFromDemerit, calibrator.adjust)",
    "\u274C \u8FC7\u5EA6\u62BD\u8C61 ('\u76F4\u63A5 emit \u65B0 source \u503C')",
    `\u274C \u6D4B\u8BD5\u4EE3\u7801\u5B57\u9762\u91CF ("tierFromDemerit(4, 'stable')")`,
    "\u274C \u8D85\u957F\u5B57\u9762\u91CF (>40 \u5B57\u7B26)",
    "",
    "\u3010\u8F93\u51FA\u683C\u5F0F\u3011",
    "\u53EA\u8F93\u51FA\u4E00\u884C\u7EAF\u6587\u672C\uFF1A",
    "- \u627E\u5230\u5173\u952E\u8BCD \u2192 \u8F93\u51FA\u5173\u952E\u8BCD\u672C\u8EAB (\u5982 `moment` \u6216 `innerHTML =|document.write(`)",
    "- \u627E\u4E0D\u5230\u901A\u7528\u5173\u952E\u8BCD \u2192 \u8F93\u51FA\u5B57\u9762\u91CF `null`",
    "",
    "\u4E0D\u8981 JSON, \u4E0D\u8981\u5F15\u53F7, \u4E0D\u8981\u89E3\u91CA, \u4E0D\u8981 ```fenced block\u3002"
  ].filter(Boolean).join("\n");
}

// ../core/src/importer/claude-md-parser.ts
init_esm_shims();
function extractRuleBullets(md) {
  const lines = md.split("\n");
  const out = [];
  let inTeamagentBlock = false;
  let inCodeFence = false;
  let currentBullet = null;
  let currentIndent = 0;
  const flush = () => {
    if (currentBullet && currentBullet.length > 0) {
      const joined = currentBullet.join(" ").trim();
      if (joined) out.push(joined);
    }
    currentBullet = null;
  };
  for (const rawLine of lines) {
    if (/^\s*```/.test(rawLine)) {
      inCodeFence = !inCodeFence;
      flush();
      continue;
    }
    if (inCodeFence) continue;
    if (/<!--\s*TEAMAGENT:START/.test(rawLine)) {
      inTeamagentBlock = true;
      flush();
      continue;
    }
    if (/<!--\s*TEAMAGENT:END/.test(rawLine)) {
      inTeamagentBlock = false;
      continue;
    }
    if (inTeamagentBlock) continue;
    const bulletMatch = rawLine.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const text = bulletMatch[3];
      if (currentBullet !== null && indent > currentIndent) {
        currentBullet.push(text);
        continue;
      }
      flush();
      currentBullet = [text];
      currentIndent = indent;
      continue;
    }
    if (currentBullet !== null) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        flush();
        continue;
      }
      const leadingSpace = rawLine.match(/^(\s*)/)[1].length;
      if (leadingSpace > currentIndent) {
        currentBullet.push(trimmed);
        continue;
      }
      flush();
    }
  }
  flush();
  return out;
}

// ../core/src/importer/cursor-rules-parser.ts
init_esm_shims();
function extractCursorRules(content) {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const bullets = extractRuleBullets(content);
  if (bullets.length > 0) return bullets;
  const paragraphs = trimmed.split(/\n\s*\n+/).map((p) => p.trim()).filter((p) => p.length > 0).filter((p) => !isMarkdownHeader(p));
  if (paragraphs.length >= 1) return paragraphs;
  return [trimmed];
}
function isMarkdownHeader(text) {
  const firstLine = text.split("\n")[0];
  return text.split("\n").length === 1 && /^#{1,6}\s+/.test(firstLine);
}

// ../core/src/importer/rule-structurer.ts
init_esm_shims();

// ../core/src/extractor/llm-based.ts
init_esm_shims();
var llmBasedKnowledgeExtractor = {
  async extract(input, callLLM) {
    const prompt = buildExtractionPrompt(input);
    const raw = await callLLM(prompt);
    return parseExtractionResponse(raw);
  }
};
function parseExtractionResponse(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenced = extractFencedJson(trimmed);
  const candidate = fenced ?? trimmed;
  if (/^null$/i.test(candidate.trim())) return null;
  let obj = tryParseJson(candidate);
  if (!obj) {
    const braced = extractFirstBracedObject(trimmed);
    if (braced) obj = tryParseJson(braced);
  }
  if (!obj) return null;
  return validateExtractedFields(obj);
}
function extractFencedJson(text) {
  const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  return m ? m[1].trim() : null;
}
function extractFirstBracedObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
function tryParseJson(text) {
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}
var VALID_CATEGORY = /* @__PURE__ */ new Set(["C", "E", "S", "K"]);
var VALID_TYPE = /* @__PURE__ */ new Set(["avoidance", "practice"]);
var VALID_NATURE = /* @__PURE__ */ new Set(["objective", "subjective"]);
function validateExtractedFields(raw) {
  const {
    category,
    tags,
    type,
    nature,
    trigger,
    wrong_pattern,
    correct_pattern,
    reasoning
  } = raw;
  if (typeof category !== "string" || !VALID_CATEGORY.has(category)) return null;
  if (typeof type !== "string" || !VALID_TYPE.has(type)) return null;
  if (typeof nature !== "string" || !VALID_NATURE.has(nature)) return null;
  if (typeof trigger !== "string" || !trigger.trim()) return null;
  if (typeof correct_pattern !== "string" || !correct_pattern.trim()) return null;
  if (typeof reasoning !== "string" || !reasoning.trim()) return null;
  let tagArr = [];
  if (Array.isArray(tags)) {
    tagArr = tags.filter((t) => typeof t === "string" && t.trim() !== "");
  }
  const wp = typeof wrong_pattern === "string" ? wrong_pattern : "";
  return {
    category,
    tags: tagArr,
    type,
    nature,
    trigger: trigger.trim(),
    wrong_pattern: wp,
    correct_pattern: correct_pattern.trim(),
    reasoning: reasoning.trim()
  };
}

// ../core/src/importer/rule-structurer.ts
async function structureRuleText(text, callLLM) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return llmBasedKnowledgeExtractor.extract(
    { kind: "rule-text", context: trimmed, weight: DEFAULT_IMPORT_CONFIDENCE },
    callLLM
  );
}
var DEFAULT_IMPORT_CONFIDENCE = 0.7;
async function structureRuleTextsBatch(texts, callLLM, opts = {}) {
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const result = {
    total: texts.length,
    structured: [],
    skipped: 0,
    failed: 0
  };
  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed) {
      result.skipped++;
      continue;
    }
    try {
      const partial = await structureRuleText(trimmed, callLLM);
      if (partial === null) {
        result.skipped++;
        opts.bus?.emit({
          source: "importer",
          action: "skipped",
          severity: "info",
          userFacingValue: `\u89C4\u5219\u6587\u672C\u65E0\u6CD5\u7ED3\u6784\u5316: ${truncate(trimmed, 60)}`,
          timestamp: now().toISOString()
        });
      } else {
        result.structured.push({ sourceText: trimmed, partial });
        opts.bus?.emit({
          source: "importer",
          action: "structured",
          severity: "highlight",
          userFacingValue: `\u5DF2\u5BFC\u5165: ${truncate(trimmed, 60)}`,
          timestamp: now().toISOString()
        });
      }
    } catch (err) {
      result.failed++;
      opts.bus?.emit({
        source: "importer",
        action: "failed",
        severity: "warning",
        userFacingValue: `\u5BFC\u5165\u5931\u8D25 (${String(err).slice(0, 80)}): ${truncate(trimmed, 40)}`,
        timestamp: now().toISOString()
      });
    }
  }
  return result;
}
function truncate(s, max) {
  return s.length <= max ? s : s.slice(0, max) + "\u2026";
}

// ../core/src/detect-stack/index.ts
init_esm_shims();
function detectStack(fs) {
  const languages = /* @__PURE__ */ new Set();
  const frameworks = /* @__PURE__ */ new Set();
  const pms = /* @__PURE__ */ new Set();
  const testRunners = /* @__PURE__ */ new Set();
  const other = /* @__PURE__ */ new Set();
  const raw = {};
  const note = (bucket, signal) => {
    if (!raw[bucket]) raw[bucket] = [];
    raw[bucket].push(signal);
  };
  if (fs.exists("pnpm-lock.yaml")) {
    pms.add("pnpm");
    note("packageManagers", "pnpm-lock.yaml");
  }
  if (fs.exists("yarn.lock")) {
    pms.add("yarn");
    note("packageManagers", "yarn.lock");
  }
  if (fs.exists("package-lock.json")) {
    pms.add("npm");
    note("packageManagers", "package-lock.json");
  }
  if (fs.exists("bun.lockb") || fs.exists("bun.lock")) {
    pms.add("bun");
    note("packageManagers", "bun.lock*");
  }
  const pkgJson = fs.read("package.json");
  if (fs.exists("package.json")) {
    languages.add("javascript");
    note("languages", "package.json");
    if (fs.exists("tsconfig.json") || fs.exists("tsconfig.base.json")) {
      languages.add("typescript");
      note("languages", "tsconfig.json");
    }
    if (pkgJson) {
      const deps = extractDeps(pkgJson);
      const has = (name) => deps.includes(name);
      if (has("react")) frameworks.add("react");
      if (has("vue")) frameworks.add("vue");
      if (has("svelte")) frameworks.add("svelte");
      if (has("next")) frameworks.add("next");
      if (has("nuxt")) frameworks.add("nuxt");
      if (has("astro")) frameworks.add("astro");
      if (has("express")) frameworks.add("express");
      if (has("fastify")) frameworks.add("fastify");
      if (has("@nestjs/core")) frameworks.add("nestjs");
      if (has("vitest")) testRunners.add("vitest");
      if (has("jest")) testRunners.add("jest");
      if (has("mocha")) testRunners.add("mocha");
      if (has("playwright") || has("@playwright/test")) testRunners.add("playwright");
      if (has("cypress")) testRunners.add("cypress");
      for (const f of frameworks) note("frameworks", `package.json \u2192 ${f}`);
      for (const t of testRunners) note("testRunners", `package.json \u2192 ${t}`);
    }
  }
  if (fs.exists("pnpm-workspace.yaml")) {
    other.add("monorepo");
    note("otherSignals", "pnpm-workspace.yaml");
  } else if (pkgJson && /"workspaces"\s*:/.test(pkgJson)) {
    other.add("monorepo");
    note("otherSignals", "package.json workspaces");
  }
  if (fs.exists("pyproject.toml")) {
    languages.add("python");
    note("languages", "pyproject.toml");
    const py = fs.read("pyproject.toml") ?? "";
    if (/poetry/.test(py)) pms.add("poetry");
    if (/\[tool\.uv\]/.test(py) || fs.exists("uv.lock")) pms.add("uv");
    if (/pytest/.test(py)) testRunners.add("pytest");
    if (/django/.test(py)) frameworks.add("django");
    if (/fastapi/.test(py)) frameworks.add("fastapi");
    if (/flask/.test(py)) frameworks.add("flask");
  }
  if (fs.exists("requirements.txt")) {
    languages.add("python");
    note("languages", "requirements.txt");
  }
  if (fs.exists("Pipfile")) {
    languages.add("python");
    pms.add("pipenv");
    note("languages", "Pipfile");
  }
  if (fs.exists("go.mod")) {
    languages.add("go");
    note("languages", "go.mod");
  }
  if (fs.exists("Cargo.toml")) {
    languages.add("rust");
    pms.add("cargo");
    note("languages", "Cargo.toml");
  }
  if (fs.exists("pom.xml")) {
    languages.add("java");
    pms.add("maven");
    note("languages", "pom.xml");
  }
  if (fs.exists("build.gradle") || fs.exists("build.gradle.kts")) {
    languages.add("java");
    if (fs.exists("build.gradle.kts")) languages.add("kotlin");
    pms.add("gradle");
    note("languages", "build.gradle");
  }
  if (fs.exists("Dockerfile") || fs.exists("docker-compose.yml")) {
    other.add("docker");
    note("otherSignals", "Dockerfile/compose");
  }
  if (fs.exists(".github/workflows")) {
    other.add("github-actions");
    note("otherSignals", ".github/workflows");
  }
  if (fs.exists("CLAUDE.md")) {
    other.add("claude-code");
    note("otherSignals", "CLAUDE.md");
  }
  if (fs.exists(".cursorrules") || fs.exists(".cursor/rules")) {
    other.add("cursor");
    note("otherSignals", ".cursorrules");
  }
  return {
    languages: [...languages].sort(),
    frameworks: [...frameworks].sort(),
    packageManagers: [...pms].sort(),
    testRunners: [...testRunners].sort(),
    otherSignals: [...other].sort(),
    raw
  };
}
function extractDeps(pkgJson) {
  try {
    const obj = JSON.parse(pkgJson);
    const names = /* @__PURE__ */ new Set();
    for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
      const section = obj[key];
      if (section && typeof section === "object") {
        for (const name of Object.keys(section)) names.add(name);
      }
    }
    return [...names];
  } catch {
    return [];
  }
}

// ../core/src/init/meta-principles.ts
init_esm_shims();
function getMetaPrinciples(now = () => /* @__PURE__ */ new Date()) {
  const created = now().toISOString();
  return [
    // ── 保留 ──
    makePreset({
      id: "preset-tdd-cycle",
      category: "S",
      tags: ["tdd", "workflow"],
      trigger: "\u5F00\u59CB\u5B9E\u73B0\u4E00\u4E2A\u65B0\u529F\u80FD\u6216\u4FEE bug \u65F6",
      correct: "\u5148\u5199\u5931\u8D25\u6D4B\u8BD5\uFF08\u7EA2\uFF09\u2192 \u5199\u6700\u5C0F\u5B9E\u73B0\uFF08\u7EFF\uFF09\u2192 \u91CD\u6784\uFF08\u5982\u9700\uFF09\u2192 commit\uFF1B\u9A8C\u8BC1\u4EA7\u51FA\uFF08\u8DD1\u6D4B\u8BD5\u3001\u624B\u52A8\u9A8C\u8BC1\uFF09\u540E\u518D\u58F0\u660E\u5B8C\u6210",
      reason: "TDD \u8BA9\u63A5\u53E3\u8BBE\u8BA1\u5148\u884C\uFF1B\u672A\u7ECF\u9A8C\u8BC1\u76F4\u63A5\u58F0\u660E\u5B8C\u6210\u662F\u5E38\u89C1\u9519\u8BEF\uFF0C\u5B9E\u9645\u8F93\u51FA\u4E0E\u9884\u671F\u53EF\u80FD\u504F\u5DEE",
      created
    }),
    makePreset({
      id: "preset-small-commits",
      category: "S",
      tags: ["git", "workflow"],
      trigger: "\u51C6\u5907 git commit \u65F6",
      correct: "\u4E00\u4E2A commit \u53EA\u505A\u4E00\u4EF6\u6982\u5FF5\u4E0A\u5B8C\u6574\u7684\u4E8B\uFF0Ctests \u8981\u8FC7\uFF1Bcommit message \u8BF4\u6E05'\u505A\u4E86\u4EC0\u4E48+\u4E3A\u4EC0\u4E48'",
      reason: "\u5C0F commit \u8BA9 review \u5BB9\u6613\u3001\u56DE\u6EDA\u7C92\u5EA6\u7EC6\u3001git bisect \u6709\u610F\u4E49\uFF1B\u6279\u91CF\u63D0\u4EA4\u4F1A\u8BA9 bug \u5B9A\u4F4D\u53D8\u5669\u68A6",
      created
    }),
    makePreset({
      id: "preset-prefer-edit-over-create",
      category: "S",
      tags: ["scope", "workflow"],
      trigger: "\u51C6\u5907\u65B0\u5EFA\u4E00\u4E2A\u6587\u4EF6\u5B8C\u6210\u67D0\u4EFB\u52A1\u65F6",
      correct: "\u5148\u786E\u8BA4\u9879\u76EE\u91CC\u6709\u6CA1\u6709\u5DF2\u6709\u6587\u4EF6\u80FD\u627F\u8F7D\u8BE5\u6539\u52A8\uFF1B\u4F18\u5148\u7F16\u8F91\u73B0\u6709\u6587\u4EF6\uFF0C\u53EA\u5728\u771F\u7684\u9700\u8981\u65F6\u624D\u65B0\u5EFA",
      reason: "\u4E0D\u5FC5\u8981\u7684\u65B0\u6587\u4EF6\u4F1A\u8BA9 reviewer \u5206\u5FC3\u3001\u8BA9 import \u5173\u7CFB\u590D\u6742\uFF1B\u5927\u591A\u6570\u5C0F\u6539\u52A8\u5E94\u8BE5\u5728\u73B0\u6709\u6A21\u5757\u91CC\u5B8C\u6210",
      created
    }),
    makeCanonicalPreset({
      id: "preset-search-web-before-trusting-memory",
      category: "K",
      tags: ["epistemics", "web-search", "groundedness"],
      trigger: "\u7528\u6237\u63D0\u5230\u4E00\u4E2A\u4F60\u6CA1\u89C1\u8FC7\u6216\u4E0D\u5B8C\u5168\u786E\u5B9A\u7684\u6982\u5FF5\u3001\u5E93\u540D\u3001API\u3001\u672F\u8BED\u65F6",
      correct: "\u4E0D\u8981\u51ED\u8BB0\u5FC6\u4F5C\u7B54\uFF1B\u4F18\u5148\u7528 WebSearch/WebFetch \u6216 mcp \u641C\u7D22\u5DE5\u5177\u9A8C\u8BC1\uFF0C\u518D\u7ED3\u5408\u5F53\u524D\u4EE3\u7801\u4E0A\u4E0B\u6587\u4F5C\u7B54",
      reason: "\u6A21\u578B\u8BB0\u5FC6\u4F1A\u8FC7\u65F6\u6216\u81C6\u9020\uFF08\u5E7B\u89C9\uFF09\uFF1B\u7528\u6237\u7528\u5230\u7684\u65B0\u6982\u5FF5\u5E38\u5728\u8BAD\u7EC3\u6570\u636E\u622A\u6B62\u4E4B\u540E\u51FA\u73B0\u3002\u5148\u641C\u7D22\u518D\u4F5C\u7B54\u53EF\u907F\u514D\u7ED9\u51FA\u9519\u8BEF\u4E8B\u5B9E\u3001\u8BEF\u5BFC\u7528\u6237",
      created
    }),
    // ── 新增 ──
    makePreset({
      id: "preset-audience-adaptive",
      category: "K",
      tags: ["communication", "explanation"],
      trigger: "\u5411\u7528\u6237\u8BB2\u89E3\u6280\u672F\u7CFB\u7EDF\u3001\u65B9\u6848\u3001\u5206\u6790\u7ED3\u679C\u6216\u64CD\u4F5C\u6D41\u7A0B\u65F6",
      correct: "\u5148\u5224\u65AD\u53D7\u4F17\u5C42\u7EA7\uFF1A\u975E\u6280\u672F\u53D7\u4F17\u7ED9\u529F\u80FD\u9AA8\u67B6\uFF08\u505A\u4EC0\u4E48/\u4E3A\u4EC0\u4E48\uFF09\u4E0D\u7ED9\u5B9E\u73B0\u7EC6\u8282\uFF1B\u6280\u672F\u53D7\u4F17\u7ED9\u673A\u5236\u5C42\uFF1B\u6240\u6709\u53D7\u4F17\u90FD\u5148\u7ED3\u8BBA\u540E\u7EC6\u8282\uFF0C\u4ECE\u7B80\u5230\u7E41",
      reason: "\u6280\u672F\u7EC6\u8282\u4F1A\u6DF9\u6CA1\u975E\u6280\u672F\u53D7\u4F17\uFF1B\u8FC7\u5EA6\u7B80\u5316\u4F1A\u6D6A\u8D39\u6280\u672F\u53D7\u4F17\u65F6\u95F4\uFF1B\u5148\u5339\u914D\u53D7\u4F17\u5FC3\u667A\u6A21\u578B\u518D\u8C03\u6574\u6DF1\u5EA6\uFF0C\u662F\u6700\u9AD8\u6548\u7684\u8BB2\u89E3\u8DEF\u5F84",
      created
    }),
    makePreset({
      id: "preset-execute-not-analyze",
      category: "S",
      tags: ["execution", "workflow"],
      trigger: "\u6536\u5230\u660E\u786E\u7684\u6267\u884C\u7C7B\u4EFB\u52A1\uFF08\u4FEE bug\u3001\u5B9E\u73B0\u529F\u80FD\u3001\u591A\u6B65\u5DE5\u4F5C\u6D41\u3001\u6279\u91CF\u5904\u7406\uFF09\u65F6",
      correct: "\u6267\u884C\u5B8C\u6574\u5E8F\u5217\u5230\u5E95\uFF0C\u4E0D\u8981\u5728\u5206\u6790/\u6C47\u62A5\u9636\u6BB5\u505C\u4E0B\u7B49\u5F85\u786E\u8BA4\uFF1B\u53EA\u5728\u9047\u5230\u4E0D\u53EF\u9006\u64CD\u4F5C\uFF08\u5220\u5E93\u3001force push\uFF09\u6216\u771F\u6B63\u65E0\u6CD5\u89E3\u51B3\u7684\u6B67\u4E49\u65F6\u624D\u6682\u505C",
      reason: "\u7528\u6237\u671F\u671B AI \u4E3B\u52A8\u63A8\u8FDB\u5DE5\u4F5C\uFF1B\u9891\u7E41\u505C\u4E0B'\u5148\u62A5\u544A''\u5148\u5BF9\u9F50'\u4F1A\u5272\u88C2\u4E0A\u4E0B\u6587\u3001\u964D\u4F4E\u6548\u7387\uFF1B\u5B8C\u6574\u6267\u884C\u518D\u62A5\u7ED3\u679C\u662F\u66F4\u597D\u7684\u8282\u594F",
      created
    }),
    makePreset({
      id: "preset-read-before-asserting",
      category: "K",
      tags: ["groundedness", "file-access"],
      trigger: "\u5373\u5C06\u65AD\u8A00\u67D0\u6587\u4EF6/\u529F\u80FD/\u6A21\u5757\u4E0D\u5B58\u5728\uFF0C\u6216\u58F0\u79F0\u300C\u8BA1\u5212\u6587\u6863\u8FD8\u6CA1\u5B9E\u73B0\u300D\u300C\u8FD9\u4E2A\u8DEF\u5F84\u6CA1\u6709\u5185\u5BB9\u300D\u65F6",
      correct: "\u5148\u7528 Read \u5DE5\u5177\u8BFB\u53D6\u7528\u6237\u6307\u5411\u7684\u8DEF\u5F84\uFF0C\u4EE5\u5B9E\u9645\u6587\u4EF6\u5185\u5BB9\u4E3A\u51C6\uFF0C\u518D\u57FA\u4E8E\u771F\u5B9E\u5185\u5BB9\u63A8\u8FDB\uFF1B\u4E0D\u8981\u51ED\u5370\u8C61\u6216\u5BF9\u8BDD\u5386\u53F2\u65AD\u8A00\u5B58\u5728\u6027",
      reason: "AI \u65AD\u8A00\u6587\u4EF6\u4E0D\u5B58\u5728\u4F46\u7528\u6237\u5DF2\u6307\u5411\u5177\u4F53\u8DEF\u5F84\u662F\u5E38\u89C1\u9519\u8BEF\uFF1B\u5B9E\u9645\u6587\u4EF6\u53EF\u80FD\u5DF2\u7ECF\u5B58\u5728\u6216\u5DF2\u5B9E\u73B0\uFF0C\u51ED\u5370\u8C61\u65AD\u8A00\u4F1A\u8BEF\u5BFC\u7528\u6237\u5E76\u6D6A\u8D39\u8C03\u8BD5\u65F6\u95F4",
      created
    }),
    makePreset({
      id: "preset-full-pipeline-for-complex",
      category: "S",
      tags: ["workflow", "architecture", "planning"],
      trigger: "\u9762\u5BF9\u591A\u7EC4\u4EF6\u3001\u591A\u9636\u6BB5\u7684\u590D\u6742\u65B0\u529F\u80FD\u6216\u7CFB\u7EDF\u6539\u9020\u65F6",
      correct: "\u8C03\u7814 \u2192 brainstorm+\u9700\u6C42\u786E\u8BA4 \u2192 \u8BBE\u8BA1\u6587\u6863 \u2192 \u5B9E\u73B0\u8BA1\u5212 \u2192 \u6267\u884C\uFF1B\u4E0D\u5F97\u8DF3\u8FC7\u524D\u671F\u8BBE\u8BA1\u76F4\u63A5\u5199\u4EE3\u7801",
      reason: "\u8DF3\u8FC7\u524D\u671F\u8BBE\u8BA1\u76F4\u63A5\u5B9E\u73B0\u4F1A\u5BFC\u81F4\u67B6\u6784\u8FD4\u5DE5\uFF1B\u5B8C\u6574\u6D41\u6C34\u7EBF\u786E\u4FDD\u9700\u6C42\u5BF9\u9F50\u540E\u518D\u62C6\u4EFB\u52A1\uFF0C\u6267\u884C\u65F6\u8FB9\u754C\u6E05\u6670\u3001\u51CF\u5C11\u53CD\u590D",
      created
    })
  ];
}
function makePreset(args) {
  return {
    id: args.id,
    scope: { level: "global" },
    category: args.category,
    tags: args.tags,
    type: "practice",
    nature: "subjective",
    trigger: args.trigger,
    wrong_pattern: "",
    correct_pattern: args.correct,
    reasoning: args.reason,
    confidence: 0.6,
    enforcement: "suggest",
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: args.created,
    last_hit_at: "",
    last_validated_at: args.created,
    source: "preset",
    conflict_with: [],
    current_tier: "experimental",
    max_tier_ever: "experimental",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
    // M4-A: meta principles are abstract guidance (no literal wrong_pattern),
    // so they live in passive-knowledge channel — CLAUDE.md only, no runtime hook.
    channel: "passive-knowledge"
  };
}
function makeCanonicalPreset(args) {
  return {
    ...makePreset(args),
    confidence: 0.95,
    enforcement: "warn",
    current_tier: "canonical",
    max_tier_ever: "canonical",
    tier_entered_at: args.created
  };
}

// ../core/src/init/default-plugins.ts
init_esm_shims();
var DEFAULT_MARKETPLACES = [
  { name: "claude-plugins-official", repo: "anthropics/claude-plugins-official" },
  { name: "knowledge-work-plugins", repo: "anthropics/knowledge-work-plugins" },
  { name: "caveman", repo: "JuliusBrussee/caveman" }
];
var DEFAULT_PLUGINS = [
  { plugin: "superpowers", marketplace: "claude-plugins-official" },
  { plugin: "playground", marketplace: "claude-plugins-official" },
  { plugin: "sales", marketplace: "knowledge-work-plugins" },
  { plugin: "caveman", marketplace: "caveman" }
];
function parsePluginSpec(raw) {
  const spec = raw.trim();
  const atIdx = spec.indexOf("@");
  if (atIdx <= 0 || atIdx === spec.length - 1) {
    throw new Error(`invalid plugin spec: "${raw}" (expected "plugin@marketplace")`);
  }
  return {
    plugin: spec.slice(0, atIdx),
    marketplace: spec.slice(atIdx + 1)
  };
}
function formatPluginSpec(p) {
  return `${p.plugin}@${p.marketplace}`;
}

// ../core/src/calibrator/default.ts
init_esm_shims();
var W_PRE_BLOCKED = 0.05;
var W_PRE_WARNED = 0.02;
var W_POST_SUCCESS_AFTER_FIRE = 0.03;
var W_POST_FAIL_AFTER_BLOCK = -0.1;
var W_STREAK_BONUS = 0.05;
var STREAK_THRESHOLD = 5;
var ARCHIVE_THRESHOLD = 0.3;
function normalize(n) {
  if (n <= 0) return 0;
  return Math.log2(1 + n);
}
function isDocOrTestContext(event) {
  const fp = event.tool?.input?.file_path;
  if (typeof fp !== "string" || fp.length === 0) return false;
  if (/\.(md|mdx|txt|rst|adoc)$/i.test(fp)) return true;
  if (/(?:^|[/\\])(docs?|__tests__|tests?|spec|specs|fixtures?|examples?)(?:[/\\]|$)/i.test(
    fp
  )) {
    return true;
  }
  if (fp.includes("/.teamagent/") || fp.includes("\\.teamagent\\")) return true;
  return false;
}
var defaultCalibrator = {
  calibrate(entry, events) {
    const ourEvents = events.filter((e) => e.knowledge_id === entry.id);
    const signals = [];
    const blockedAll = ourEvents.filter((e) => e.kind === "hook-pre.blocked");
    const warnedAll = ourEvents.filter((e) => e.kind === "hook-pre.warned");
    const blockedReal = blockedAll.filter((e) => !isDocOrTestContext(e));
    const blockedDoc = blockedAll.filter((e) => isDocOrTestContext(e));
    const warnedReal = warnedAll.filter((e) => !isDocOrTestContext(e));
    const warnedDoc = warnedAll.filter((e) => isDocOrTestContext(e));
    if (blockedReal.length > 0) {
      signals.push({
        kind: "hook-pre.blocked",
        weight: W_PRE_BLOCKED * normalize(blockedReal.length),
        event_ids: blockedReal.map((e) => e.id)
      });
    }
    if (blockedDoc.length > 0) {
      signals.push({
        kind: "hook-pre.blocked.doc_context",
        weight: -W_PRE_BLOCKED * normalize(blockedDoc.length),
        event_ids: blockedDoc.map((e) => e.id)
      });
    }
    if (warnedReal.length > 0) {
      signals.push({
        kind: "hook-pre.warned",
        weight: W_PRE_WARNED * normalize(warnedReal.length),
        event_ids: warnedReal.map((e) => e.id)
      });
    }
    if (warnedDoc.length > 0) {
      signals.push({
        kind: "hook-pre.warned.doc_context",
        weight: -W_PRE_WARNED * normalize(warnedDoc.length),
        event_ids: warnedDoc.map((e) => e.id)
      });
    }
    const postEvents = ourEvents.filter((e) => e.kind === "hook-post.result");
    const preFireByToolUseId = /* @__PURE__ */ new Map();
    for (const e of ourEvents) {
      if ((e.kind === "hook-pre.matched" || e.kind === "hook-pre.warned" || e.kind === "hook-pre.blocked") && e.tool_use_id) {
        preFireByToolUseId.set(e.tool_use_id, e);
      }
    }
    const successAfterFire = [];
    const failAfterBlock = [];
    for (const post of postEvents) {
      if (!post.tool_use_id) continue;
      const pre = preFireByToolUseId.get(post.tool_use_id);
      if (!pre) continue;
      if (post.result?.succeeded === true) {
        successAfterFire.push(post);
      } else if (post.result?.succeeded === false && pre.kind === "hook-pre.blocked") {
        failAfterBlock.push(post);
      }
    }
    if (successAfterFire.length > 0) {
      signals.push({
        kind: "post.success_after_fire",
        weight: W_POST_SUCCESS_AFTER_FIRE * normalize(successAfterFire.length),
        event_ids: successAfterFire.map((e) => e.id)
      });
    }
    if (failAfterBlock.length > 0) {
      signals.push({
        kind: "post.fail_after_block",
        weight: W_POST_FAIL_AFTER_BLOCK * normalize(failAfterBlock.length),
        event_ids: failAfterBlock.map((e) => e.id)
      });
    }
    if (successAfterFire.length >= STREAK_THRESHOLD && failAfterBlock.length === 0) {
      signals.push({
        kind: "streak_bonus",
        weight: W_STREAK_BONUS
      });
    }
    const totalDelta = signals.reduce((s, sig) => s + sig.weight, 0);
    const rawNewConf = entry.confidence + totalDelta;
    const newConfidence = Math.max(0, Math.min(1, rawNewConf));
    let newStatus = entry.status;
    if (entry.status === "active" && newConfidence < ARCHIVE_THRESHOLD) {
      newStatus = "archived";
    }
    return {
      confidence: newConfidence,
      status: newStatus,
      delta: newConfidence - entry.confidence,
      applied_signals: signals
    };
  }
};

// ../core/src/pipeline/calibration-pipeline.ts
init_esm_shims();
async function runCalibrationPipeline(deps) {
  const allEntries = deps.store.getAll();
  const eventsByKnowledgeId = indexEventsByKnowledgeId(deps.events);
  const adjusted = [];
  const archivedNew = [];
  for (const entry of allEntries) {
    if (entry.status !== "active") continue;
    const entryEvents = eventsByKnowledgeId.get(entry.id) ?? [];
    if (entryEvents.length === 0) continue;
    const result = deps.calibrator.calibrate(entry, entryEvents);
    if (result.delta === 0 && result.status === entry.status) continue;
    deps.store.update(entry.id, {
      confidence: result.confidence,
      status: result.status,
      last_validated_at: deps.now().toISOString()
    });
    adjusted.push({
      knowledge_id: entry.id,
      before: entry.confidence,
      after: result.confidence,
      delta: result.delta,
      status_before: entry.status,
      status_after: result.status,
      signals: result.applied_signals
    });
    if (result.status === "archived" && entry.status === "active") {
      archivedNew.push(entry.id);
    }
    deps.bus?.emit({
      source: "calibrator",
      action: "adjusted",
      target: { id: entry.id },
      before: { confidence: entry.confidence, status: entry.status },
      after: { confidence: result.confidence, status: result.status },
      severity: result.status === "archived" && entry.status === "active" ? "warning" : "info",
      userFacingValue: result.status === "archived" && entry.status === "active" ? `${entry.id} \u81EA\u52A8\u5F52\u6863\uFF08confidence ${entry.confidence.toFixed(2)} \u2192 ${result.confidence.toFixed(2)}\uFF09` : `${entry.id} confidence ${entry.confidence.toFixed(2)} \u2192 ${result.confidence.toFixed(2)} (${result.delta > 0 ? "+" : ""}${result.delta.toFixed(2)})`,
      timestamp: deps.now().toISOString()
    });
  }
  return {
    scanned: allEntries.length,
    adjusted,
    archivedNew
  };
}
function indexEventsByKnowledgeId(events) {
  const idx = /* @__PURE__ */ new Map();
  for (const e of events) {
    if (!e.knowledge_id) continue;
    const list = idx.get(e.knowledge_id);
    if (list) list.push(e);
    else idx.set(e.knowledge_id, [e]);
  }
  return idx;
}

// ../core/src/scenario/runner.ts
init_esm_shims();

// ../core/src/pipeline/extract-pipeline.ts
init_esm_shims();
import { createHash } from "crypto";

// ../core/src/pipeline/semantic-descriptions.ts
init_esm_shims();
function buildSemanticDescriptions(source) {
  const trigger = source.trigger?.trim() || "Apply this rule when the current task matches the stored rule context.";
  const wrong = source.wrong_pattern?.trim() ?? "";
  const correct = source.correct_pattern?.trim() ?? "";
  const reason = source.reasoning?.trim() ?? "";
  return {
    trigger_description: [trigger, reason].filter(Boolean).join(" "),
    pattern_description: wrong ? [`Using or producing ${wrong}.`, correct ? `Prefer ${correct}.` : "", reason].filter(Boolean).join(" ") : [correct || trigger, reason].filter(Boolean).join(" ")
  };
}

// ../core/src/pipeline/extract-pipeline.ts
function momentSignature(moment) {
  const parts = [
    String(moment.turnIndex),
    moment.signal,
    (moment.correctionText ?? "").slice(0, 200),
    (moment.previousAssistantText ?? "").slice(0, 200)
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}
async function runExtractPipeline(session, deps) {
  const corrections = deps.detector.detect(session);
  const result = {
    correctionsFound: corrections.length,
    extracted: [],
    skipped: 0,
    failed: 0,
    rejected: [],
    deduped: 0
  };
  for (const moment of corrections) {
    const signature = momentSignature(moment);
    if (deps.isMomentSeen && deps.isMomentSeen(signature)) {
      result.deduped++;
      emit(deps.bus, {
        source: "extractor",
        action: "deduped",
        target: { count: 1 },
        severity: "info",
        userFacingValue: `\u5DF2\u5728\u5386\u53F2 run \u4E2D\u5904\u7406\u8FC7\uFF08turn ${moment.turnIndex}\uFF09`,
        timestamp: isoNow(deps.now)
      });
      continue;
    }
    const context = formatCorrectionContext(moment);
    try {
      const partial = await deps.extractor.extract(
        { kind: "correction", context, weight: moment.weight },
        deps.callLLM
      );
      if (partial === null) {
        result.skipped++;
        deps.markMomentSeen?.(signature);
        emit(deps.bus, {
          source: "extractor",
          action: "skipped",
          target: { count: 1 },
          severity: "info",
          userFacingValue: `\u7EA0\u6B63\u4FE1\u53F7\u4E0D\u8DB3\uFF0C\u672A\u63D0\u53D6\uFF08turn ${moment.turnIndex}\uFF09`,
          timestamp: isoNow(deps.now)
        });
        continue;
      }
      const entry = assembleEntry(partial, moment, deps);
      if (deps.validator) {
        const l0 = deps.validator.validateLevel0({
          entry,
          sourceText: context,
          existingRules: deps.store.getAll().map((r) => ({
            id: r.id,
            trigger: r.trigger,
            wrong_pattern: r.wrong_pattern
          })),
          projectStack: deps.projectStack ?? []
        });
        if (!l0.ok) {
          result.rejected.push({ entry, reasons: l0.failed_checks });
          deps.markMomentSeen?.(signature);
          if (deps.rejectionLog) {
            try {
              await deps.rejectionLog(entry, l0);
            } catch {
            }
          }
          emit(deps.bus, {
            source: "extractor",
            action: "rejected_l0",
            target: { id: entry.id, count: 1 },
            severity: "info",
            userFacingValue: `L0 \u62D2\u7EDD\uFF1A${l0.failed_checks.join(", ")}`,
            timestamp: isoNow(deps.now)
          });
          continue;
        }
      }
      if (deps.store.addWithEmbedding) {
        await deps.store.addWithEmbedding(entry);
      } else {
        deps.store.add(entry);
      }
      result.extracted.push(entry);
      deps.markMomentSeen?.(signature);
      emit(deps.bus, {
        source: "extractor",
        action: "extracted",
        target: { id: entry.id, count: 1 },
        severity: "highlight",
        userFacingValue: `\u5B66\u5230\uFF1A${entry.trigger} \u2192 ${entry.correct_pattern}`,
        timestamp: isoNow(deps.now)
      });
    } catch (err) {
      result.failed++;
      emit(deps.bus, {
        source: "extractor",
        action: "failed",
        target: { count: 1 },
        severity: "warning",
        userFacingValue: `\u63D0\u53D6\u5931\u8D25\uFF08turn ${moment.turnIndex}\uFF09: ${String(err).slice(0, 120)}`,
        timestamp: isoNow(deps.now)
      });
    }
  }
  if (deps.recompile) {
    try {
      await deps.recompile(deps.store.getActive());
      emit(deps.bus, {
        source: "compiler",
        action: "recompiled",
        target: { count: result.extracted.length },
        severity: "info",
        userFacingValue: `CLAUDE.md \u5DF2\u6309\u65B0\u77E5\u8BC6\u91CD\u7F16\u8BD1\uFF08+${result.extracted.length}\uFF09`,
        timestamp: isoNow(deps.now)
      });
    } catch (err) {
      emit(deps.bus, {
        source: "compiler",
        action: "failed",
        severity: "warning",
        userFacingValue: `\u91CD\u7F16\u8BD1\u5931\u8D25: ${String(err).slice(0, 120)}`,
        timestamp: isoNow(deps.now)
      });
    }
  }
  return result;
}
function formatCorrectionContext(moment) {
  const tools = moment.previousToolCalls.length ? `[AI \u4E4B\u524D\u8C03\u7528\u7684\u5DE5\u5177: ${moment.previousToolCalls.join(", ")}]
` : "";
  return [
    `[\u4FE1\u53F7: ${moment.signal}, \u6743\u91CD: ${moment.weight.toFixed(2)}]`,
    moment.previousAssistantText ? `AI \u4E4B\u524D\u8BF4: ${truncate2(moment.previousAssistantText, 600)}` : "",
    tools,
    `\u7528\u6237\u7EA0\u6B63: ${truncate2(moment.correctionText, 600)}`
  ].filter(Boolean).join("\n");
}
var DEFAULT_CODE_FILE_TYPES = [
  "*.ts",
  "*.tsx",
  "*.js",
  "*.jsx",
  "*.mjs",
  "*.cjs",
  "*.py",
  "*.go",
  "*.rs",
  "*.java",
  "*.kt",
  "*.c",
  "*.cpp",
  "*.h",
  "*.hpp",
  "*.sh",
  "*.bash",
  "*.rb",
  "*.php",
  "*.cs",
  "*.json",
  "*.yaml",
  "*.yml",
  "*.toml",
  "*.sql"
];
function assembleEntry(partial, moment, deps) {
  const confidence = moment.weight;
  const nature = partial.nature ?? "subjective";
  const enforcement = computeEnforcement(confidence, nature);
  const nowIso = isoNow(deps.now);
  const descriptions = buildSemanticDescriptions({
    trigger: partial.trigger,
    wrong_pattern: partial.wrong_pattern,
    correct_pattern: partial.correct_pattern,
    reasoning: partial.reasoning
  });
  const scopeHasExplicitRange = deps.scope.paths && deps.scope.paths.length > 0 || deps.scope.file_types && deps.scope.file_types.length > 0;
  const scope = scopeHasExplicitRange ? deps.scope : { ...deps.scope, paths: ["**/*"], file_types: [...DEFAULT_CODE_FILE_TYPES] };
  return {
    id: deps.idGen(),
    scope,
    category: partial.category ?? "E",
    tags: partial.tags ?? [],
    type: partial.type ?? "avoidance",
    nature,
    trigger: partial.trigger ?? "",
    wrong_pattern: partial.wrong_pattern ?? "",
    correct_pattern: partial.correct_pattern ?? "",
    reasoning: partial.reasoning ?? "",
    confidence,
    enforcement,
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: {
      success_sessions: 0,
      success_users: 0,
      correction_sessions: 1
    },
    created_at: nowIso,
    last_hit_at: "",
    last_validated_at: nowIso,
    source: deps.source ?? "accumulated",
    conflict_with: [],
    current_tier: "canonical",
    max_tier_ever: "canonical",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
    channel: "tool-action",
    trigger_description: partial.trigger_description ?? descriptions.trigger_description,
    pattern_description: partial.pattern_description ?? descriptions.pattern_description,
    fire_threshold: partial.fire_threshold ?? DEFAULT_FIRE_THRESHOLD,
    threshold_alpha: partial.threshold_alpha ?? 1,
    threshold_beta: partial.threshold_beta ?? 1,
    embedder_model_id: partial.embedder_model_id ?? ""
  };
}
function emit(bus, event) {
  if (!bus) return;
  try {
    bus.emit(event);
  } catch {
  }
}
function isoNow(now) {
  return now().toISOString();
}
function truncate2(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\u2026";
}

// ../core/src/scenario/runner.ts
async function runScenario(scenario, deps) {
  const errors = [];
  const result = {
    scenarioId: scenario.id,
    passed: false,
    phaseA: {
      detectorCalled: false,
      correctionsFound: 0,
      expectedMatches: [],
      passed: false
    },
    phaseB: {
      extractorCalled: false,
      ruleGenerated: false,
      rulePredicates: [],
      passed: false
    },
    phaseC: {
      matcherCalled: false,
      actualBehavior: "no-match",
      expectedBehavior: scenario.phaseC.expectedBehavior,
      passed: false
    },
    prr: 0,
    kp: 0,
    errors
  };
  let corrections;
  try {
    corrections = deps.detector.detect(scenario.phaseA.session);
    result.phaseA.detectorCalled = true;
    result.phaseA.correctionsFound = corrections.length;
  } catch (err) {
    errors.push(`Phase A detector threw: ${String(err)}`);
    return result;
  }
  result.phaseA.expectedMatches = scenario.phaseA.expectedCorrections.map(
    (exp) => ({
      signal: exp.signal,
      matched: corrections.some(
        (c) => c.signal === exp.signal && (exp.minWeight === void 0 || c.weight >= exp.minWeight) && (exp.turnIndex === void 0 || c.turnIndex === exp.turnIndex)
      )
    })
  );
  result.phaseA.passed = result.phaseA.expectedMatches.every((m) => m.matched);
  const store = deps.makeStore();
  let counter = 0;
  const idGen = deps.idGen ?? (() => `scenario-${scenario.id}-${++counter}`);
  let pipelineResult;
  try {
    pipelineResult = await runExtractPipeline(scenario.phaseA.session, {
      detector: deps.detector,
      extractor: deps.extractor,
      callLLM: async () => scenario.phaseB.mockLLMResponse,
      store,
      scope: { level: "team" },
      now: deps.now,
      idGen
    });
    result.phaseB.extractorCalled = true;
    result.phaseB.ruleGenerated = pipelineResult.extracted.length > 0;
  } catch (err) {
    errors.push(`Phase B pipeline threw: ${String(err)}`);
    return result;
  }
  const newRule = pipelineResult.extracted[0];
  if (newRule) {
    const exp = scenario.phaseB.expectedRule;
    const checks = [];
    if (exp.categoryEquals !== void 0) {
      checks.push({
        predicate: `category == ${exp.categoryEquals}`,
        passed: newRule.category === exp.categoryEquals
      });
    }
    if (exp.typeEquals !== void 0) {
      checks.push({
        predicate: `type == ${exp.typeEquals}`,
        passed: newRule.type === exp.typeEquals
      });
    }
    if (exp.natureEquals !== void 0) {
      checks.push({
        predicate: `nature == ${exp.natureEquals}`,
        passed: newRule.nature === exp.natureEquals
      });
    }
    if (exp.triggerContains !== void 0) {
      checks.push({
        predicate: `trigger contains "${exp.triggerContains}"`,
        passed: newRule.trigger.includes(exp.triggerContains)
      });
    }
    if (exp.wrongPatternContains !== void 0) {
      checks.push({
        predicate: `wrong_pattern contains "${exp.wrongPatternContains}"`,
        passed: (newRule.wrong_pattern ?? "").includes(exp.wrongPatternContains)
      });
    }
    if (exp.correctPatternContains !== void 0) {
      checks.push({
        predicate: `correct_pattern contains "${exp.correctPatternContains}"`,
        passed: newRule.correct_pattern.includes(exp.correctPatternContains)
      });
    }
    if (exp.reasoningContains !== void 0) {
      checks.push({
        predicate: `reasoning contains "${exp.reasoningContains}"`,
        passed: newRule.reasoning.includes(exp.reasoningContains)
      });
    }
    result.phaseB.rulePredicates = checks;
    result.phaseB.passed = checks.length > 0 && checks.every((c) => c.passed);
  }
  try {
    const activeRules = store.getActive();
    const matches = matchRules(
      {
        toolName: scenario.phaseC.toolCall.toolName,
        input: scenario.phaseC.toolCall.input
      },
      activeRules
    );
    result.phaseC.matcherCalled = true;
    if (matches.length === 0) {
      result.phaseC.actualBehavior = "no-match";
    } else {
      result.phaseC.actualBehavior = matches[0].enforcement;
    }
    result.phaseC.passed = result.phaseC.actualBehavior === scenario.phaseC.expectedBehavior;
  } catch (err) {
    errors.push(`Phase C matcher threw: ${String(err)}`);
  }
  result.prr = result.phaseC.passed ? 100 : 0;
  if (result.phaseB.rulePredicates.length > 0) {
    const passedCount = result.phaseB.rulePredicates.filter((c) => c.passed).length;
    result.kp = passedCount / result.phaseB.rulePredicates.length * 5;
  }
  result.passed = result.phaseA.passed && result.phaseB.passed && result.phaseC.passed;
  return result;
}
async function runVerify(scenarios, deps) {
  const results = [];
  for (const s of scenarios) {
    results.push(await runScenario(s, deps));
  }
  const passed = results.filter((r) => r.passed).length;
  const avgPRR = results.length > 0 ? results.reduce((s, r) => s + r.prr, 0) / results.length : 0;
  const avgKP = results.length > 0 ? results.reduce((s, r) => s + r.kp, 0) / results.length : 0;
  return {
    total: results.length,
    passed,
    scenarios: results,
    averagePRR: avgPRR,
    averageKP: avgKP
  };
}
function entryFromPartial(partial, id, now) {
  const confidence = partial.confidence ?? 0.7;
  const nature = partial.nature ?? "subjective";
  const nowIso = now().toISOString();
  return {
    id,
    scope: { level: "team" },
    category: partial.category ?? "E",
    tags: partial.tags ?? [],
    type: partial.type ?? "avoidance",
    nature,
    trigger: partial.trigger ?? "",
    wrong_pattern: partial.wrong_pattern ?? "",
    correct_pattern: partial.correct_pattern ?? "",
    reasoning: partial.reasoning ?? "",
    confidence,
    enforcement: computeEnforcement(confidence, nature),
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: nowIso,
    last_hit_at: "",
    last_validated_at: nowIso,
    source: "accumulated",
    conflict_with: [],
    current_tier: "experimental",
    max_tier_ever: "experimental",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
    channel: "tool-action"
  };
}

// ../core/src/calibrator/v2/index.ts
init_esm_shims();

// ../core/src/calibrator/v2/wilson.ts
init_esm_shims();
var HALF_LIFE_DAYS = {
  experimental: 30,
  probation: 45,
  stable: 60,
  canonical: 75,
  enforced: 90
};
var DAY_MS = 24 * 3600 * 1e3;
var Z = 1.96;
function computeConfidence(observations, maxTierEver, now) {
  if (observations.length === 0) return 0;
  const tier = maxTierEver === "dormant" ? "experimental" : maxTierEver;
  const halfLife = HALF_LIFE_DAYS[tier];
  const lambda = Math.LN2 / halfLife;
  let weightedSuccess = 0;
  let weightedFailure = 0;
  for (const o of observations) {
    const tsMs = new Date(o.timestamp).getTime();
    if (!Number.isFinite(tsMs)) continue;
    const daysAgo = (now.getTime() - tsMs) / DAY_MS;
    const w = Math.exp(-lambda * Math.max(0, daysAgo));
    if (o.outcome === "success") weightedSuccess += w;
    else weightedFailure += w;
  }
  const n = weightedSuccess + weightedFailure;
  if (n === 0) return 0;
  const p = weightedSuccess / n;
  const wilson = (p + Z * Z / (2 * n) - Z * Math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n))) / (1 + Z * Z / n);
  return Math.max(0, Math.min(1, wilson));
}

// ../core/src/calibrator/v2/demerit.ts
init_esm_shims();
var DAY_MS2 = 24 * 3600 * 1e3;
var DEMERIT_HALF_LIFE_DAYS = {
  experimental: 7,
  probation: 10,
  stable: 14,
  canonical: 21,
  enforced: 28
};
var DEMERIT_BASE_BY_TIER = {
  experimental: 1,
  probation: 2,
  stable: 3,
  canonical: 5,
  enforced: 10
};
function computeDemerit(input, events, now) {
  const breakdown = [];
  const tier = input.current_tier === "dormant" ? "experimental" : input.current_tier;
  let d = input.current;
  if (d > 0 && input.last_updated) {
    const daysSince = Math.max(0, (now.getTime() - new Date(input.last_updated).getTime()) / DAY_MS2);
    if (daysSince > 0) {
      const lambda = Math.LN2 / DEMERIT_HALF_LIFE_DAYS[tier];
      const decayed = d * Math.exp(-lambda * daysSince);
      breakdown.push({
        type: "demerit_decay",
        days_since: daysSince,
        demerit_delta: decayed - d,
        note: `half-life=${DEMERIT_HALF_LIFE_DAYS[tier]}d at tier=${tier}`
      });
      d = decayed;
    }
  }
  for (const e of events) {
    const base = DEMERIT_BASE_BY_TIER[tier];
    const cappedConf = Math.min(input.confidence, 0.99);
    const multiplier = Math.max(1, -Math.log(1 - cappedConf));
    const userOverride = e.source === "user_reject" ? 10 : 0;
    const delta = base * multiplier + userOverride;
    breakdown.push({
      type: "demerit_added",
      demerit_delta: delta,
      note: `source=${e.source}, base=${base}, mult=${multiplier.toFixed(2)}, override=+${userOverride}`
    });
    d += delta;
  }
  return { demerit: Math.max(0, d), breakdown };
}

// ../core/src/calibrator/v2/tier.ts
init_esm_shims();
var TIER_ORDER = [
  "experimental",
  "probation",
  "stable",
  "canonical",
  "enforced"
];
function tierFromConfidence(conf) {
  if (conf < 0.3) return "experimental";
  if (conf < 0.55) return "probation";
  if (conf < 0.75) return "stable";
  if (conf < 0.9) return "canonical";
  return "enforced";
}
function tierFromDemerit(demerit, currentTier) {
  if (demerit >= 50) return "dormant";
  const activeTier = currentTier === "dormant" ? "experimental" : currentTier;
  const idx = TIER_ORDER.indexOf(activeTier);
  if (idx === -1) return currentTier;
  let demote = 0;
  if (demerit >= 15) demote = 2;
  else if (demerit >= 5) demote = 1;
  if (demote === 0) return "enforced";
  return TIER_ORDER[Math.max(0, idx - demote)];
}
function effectiveTier(confidence, demerit, currentTier) {
  const byConf = tierFromConfidence(confidence);
  const byDemerit = tierFromDemerit(demerit, currentTier);
  if (byDemerit === "dormant") return "dormant";
  const confIdx = TIER_ORDER.indexOf(byConf);
  const demIdx = TIER_ORDER.indexOf(byDemerit);
  return TIER_ORDER[Math.min(confIdx, demIdx)];
}

// ../core/src/calibrator/v2/hysteresis.ts
init_esm_shims();
var DAY_MS3 = 24 * 3600 * 1e3;
var MIN_OBS_FOR_PROMOTION = 10;
var MIN_DAYS_FOR_DEMOTION = 7;
var MAX_DEMERIT_FOR_PROMOTION = 2.5;
function tierRank(t) {
  if (t === "dormant") return -1;
  return TIER_ORDER.indexOf(t);
}
function applyHysteresis(input) {
  const cur = input.current_tier;
  const cand = input.candidate_tier;
  if (cur === cand) return { final_tier: cur };
  if (cand === "dormant") return { final_tier: "dormant" };
  if (cur === "dormant") return { final_tier: cand };
  const curRank = tierRank(cur);
  const candRank = tierRank(cand);
  if (candRank > curRank) {
    if (input.observation_count_in_current_tier < MIN_OBS_FOR_PROMOTION) {
      return {
        final_tier: cur,
        blocked_reason: `need >= ${MIN_OBS_FOR_PROMOTION} observations in current tier (have ${input.observation_count_in_current_tier})`
      };
    }
    if (input.demerit >= MAX_DEMERIT_FOR_PROMOTION) {
      return {
        final_tier: cur,
        blocked_reason: `demerit ${input.demerit.toFixed(2)} >= promotion threshold ${MAX_DEMERIT_FOR_PROMOTION}`
      };
    }
    return { final_tier: cand };
  }
  if (input.demerit >= 30) return { final_tier: cand };
  const enteredMs = input.tier_entered_at ? new Date(input.tier_entered_at).getTime() : input.now.getTime();
  const daysSince = (input.now.getTime() - enteredMs) / DAY_MS3;
  if (daysSince < MIN_DAYS_FOR_DEMOTION) {
    return {
      final_tier: cur,
      blocked_reason: `demotion requires >= 7 days in current tier (${daysSince.toFixed(1)} days so far)`
    };
  }
  return { final_tier: cand };
}

// ../core/src/calibrator/v2/index.ts
var DEMERIT_KIND_TO_SOURCE = {
  "ai.override.ignored": "ai_override_ignored",
  // M3: block 被绕路 → 复用 ai_override_ignored 权重（demerit base 一致）
  "ai.override.blocked_circumvented": "ai_override_ignored",
  // M4-A: AI 被注入警告后下一轮又说了同类话术 → 教育失败，复用 ignored 权重
  "ai.narrative.recurred": "ai_override_ignored",
  "calibrator.user_reject": "user_reject",
  "validator.failure": "validator_fail"
};
function eventsToDemeritEvents(events, knowledgeId) {
  const out = [];
  for (const e of events) {
    if (e.knowledge_id !== knowledgeId) continue;
    const source = DEMERIT_KIND_TO_SOURCE[e.kind];
    if (!source) continue;
    out.push({ source, timestamp: e.timestamp });
  }
  return out;
}
function statusFromTier(oldStatus, tier) {
  if (tier === "dormant") return "dormant";
  if (oldStatus === "conflict" || oldStatus === "stale") return oldStatus;
  return "active";
}
var v2Calibrator = {
  calibrate(entry, input) {
    const ownObs = input.observations.filter(
      (o) => o.knowledge_id === entry.id
    );
    const newConfidence = ownObs.length > 0 ? computeConfidence(ownObs, entry.max_tier_ever, input.now) : entry.confidence;
    const demeritEvents = eventsToDemeritEvents(input.events, entry.id);
    const demeritRes = computeDemerit(
      {
        current: entry.demerit,
        last_updated: entry.demerit_last_updated,
        current_tier: entry.current_tier,
        confidence: newConfidence
      },
      demeritEvents,
      input.now
    );
    const candidate = effectiveTier(newConfidence, demeritRes.demerit, entry.current_tier);
    const enteredAt = entry.tier_entered_at || entry.created_at;
    const obsInCurrentTier = ownObs.filter(
      (o) => new Date(o.timestamp) >= new Date(enteredAt)
    ).length;
    const hys = applyHysteresis({
      current_tier: entry.current_tier,
      candidate_tier: candidate,
      confidence: newConfidence,
      demerit: demeritRes.demerit,
      tier_entered_at: enteredAt,
      observation_count_in_current_tier: obsInCurrentTier,
      now: input.now
    });
    const breakdown = [];
    if (ownObs.length > 0) {
      breakdown.push({
        type: "obs_added",
        weight: ownObs.length,
        conf_delta: newConfidence - entry.confidence,
        note: `${ownObs.length} observations \u2192 Wilson LB`
      });
    }
    breakdown.push(...demeritRes.breakdown);
    const tierTransition = hys.final_tier !== entry.current_tier ? {
      from: entry.current_tier,
      to: hys.final_tier,
      reason: demeritRes.demerit >= 30 ? "death_chain_dormant" : "hysteresis_passed"
    } : null;
    if (tierTransition) {
      breakdown.push({
        type: "tier_transition",
        note: `${tierTransition.from} \u2192 ${tierTransition.to} (${tierTransition.reason})`
      });
    }
    return {
      confidence: newConfidence,
      demerit: demeritRes.demerit,
      tier_before: entry.current_tier,
      tier_after: hys.final_tier,
      status: statusFromTier(entry.status, hys.final_tier),
      confidence_delta: newConfidence - entry.confidence,
      demerit_delta: demeritRes.demerit - entry.demerit,
      delta_breakdown: breakdown,
      tier_transition: tierTransition,
      reason_for_no_transition: hys.blocked_reason
    };
  }
};

// ../core/src/pipeline/calibration-pipeline-v2.ts
init_esm_shims();
async function runCalibrationPipelineV2(deps) {
  const entries = deps.store.getAll();
  const now = deps.now();
  const syntheticObs = deps.events.filter((e) => e.knowledge_id && syntheticOutcomeForEvent(e.kind) !== null).map((e) => ({
    id: `synth-${e.kind}-${e.id}`,
    knowledge_id: e.knowledge_id,
    timestamp: e.timestamp,
    outcome: syntheticOutcomeForEvent(e.kind),
    source_event: e.id,
    tool_use_id: e.tool_use_id
  }));
  const allObservations = [...deps.observations, ...syntheticObs];
  const obsIdx = indexByKnowledgeId(allObservations);
  const evtIdx = indexByKnowledgeId(deps.events);
  const adjusted = [];
  const dormantNew = [];
  for (const entry of entries) {
    if (entry.status === "archived") continue;
    const isDormant = entry.status === "dormant" || entry.current_tier === "dormant";
    if (isDormant && entry.demerit >= 50) continue;
    const obsForEntry = obsIdx.get(entry.id) ?? [];
    const evtForEntry = evtIdx.get(entry.id) ?? [];
    if (!isDormant && obsForEntry.length === 0 && evtForEntry.length === 0 && entry.demerit === 0) {
      continue;
    }
    const calResult = deps.calibrator.calibrate(entry, {
      events: evtForEntry,
      observations: obsForEntry,
      now
    });
    let result = calResult;
    if (deps.validator && deps.callLLM && result.tier_transition && isPromotion(result.tier_before, result.tier_after)) {
      const proposedTier = result.tier_after;
      const needsL1 = L1_GATED_TIERS.has(proposedTier);
      if (needsL1) {
        const similar = deps.similarityFinder ? await deps.similarityFinder(entry).catch(() => []) : [];
        const l1 = await deps.validator.validateLevel1({ entry, similarRules: similar }, deps.callLLM).catch((e) => ({
          ok: false,
          confidence: 0,
          reason: `validator_l1_error: ${String(e).slice(0, 120)}`
        }));
        if (!l1.ok) {
          result = overrideTier(
            result,
            entry.current_tier,
            `l1_blocked: ${l1.reason}`
          );
          deps.bus?.emit({
            source: "validator",
            action: "blocked_promotion",
            target: { id: entry.id },
            severity: "info",
            userFacingValue: `L1 blocked ${entry.current_tier} \u2192 ${proposedTier}: ${l1.reason}`,
            timestamp: now.toISOString()
          });
        }
      }
      const needsL2 = L2_GATED_TIERS.has(proposedTier) && result.tier_transition !== null;
      if (needsL2) {
        const recentHits = evtForEntry.filter(
          (e) => e.kind === "hook-pre.matched" || e.kind === "hook-pre.blocked"
        ).slice(-20).map((e) => ({
          tool_input: e.payload?.tool_input ?? null,
          timestamp: e.timestamp
        }));
        const seniors = deps.store.getAll().filter(
          (r) => (r.current_tier === "canonical" || r.current_tier === "enforced") && r.id !== entry.id
        );
        const l2 = await deps.validator.validateLevel2(
          { entry, recentHits, existingSeniorRules: seniors },
          deps.callLLM
        ).catch((e) => ({
          ok: false,
          confidence: 0,
          reason: `validator_l2_error: ${String(e).slice(0, 120)}`
        }));
        if (!l2.ok) {
          result = overrideTier(
            result,
            entry.current_tier,
            `l2_blocked: ${l2.reason}`
          );
          deps.bus?.emit({
            source: "validator",
            action: "blocked_promotion",
            target: { id: entry.id },
            severity: "info",
            userFacingValue: `L2 blocked ${entry.current_tier} \u2192 ${proposedTier}: ${l2.reason}`,
            timestamp: now.toISOString()
          });
        }
      }
    }
    const confChanged = Math.abs(result.confidence_delta) > 1e-6;
    const demChanged = Math.abs(result.demerit_delta) > 1e-6;
    const tierChanged = result.tier_transition !== null;
    if (!confChanged && !demChanged && !tierChanged) continue;
    if (tierChanged) {
      const wasStablePlus = STABLE_PLUS.has(result.tier_before);
      const isStablePlus = STABLE_PLUS.has(result.tier_after);
      if (!wasStablePlus && isStablePlus) {
        deps.bus?.emit({
          source: "compile",
          action: "skill_should_write",
          target: { id: entry.id },
          severity: "info",
          userFacingValue: `tier ${result.tier_before} \u2192 ${result.tier_after}\uFF0C\u5C06\u5BFC\u51FA skill`,
          timestamp: now.toISOString()
        });
      } else if (wasStablePlus && !isStablePlus) {
        deps.bus?.emit({
          source: "compile",
          action: "skill_should_remove",
          target: { id: entry.id },
          severity: "info",
          userFacingValue: `tier ${result.tier_before} \u2192 ${result.tier_after}\uFF0C\u5C06\u79FB\u9664 skill`,
          timestamp: now.toISOString()
        });
      }
    }
    if (!deps.dryRun) {
      deps.store.update(entry.id, {
        confidence: result.confidence,
        demerit: result.demerit,
        current_tier: result.tier_after,
        status: result.status,
        demerit_last_updated: now.toISOString(),
        tier_entered_at: tierChanged ? now.toISOString() : entry.tier_entered_at,
        max_tier_ever: tierChanged && tierRankGt(result.tier_after, entry.max_tier_ever) ? result.tier_after : entry.max_tier_ever,
        last_validated_at: now.toISOString()
      });
    }
    if (result.tier_after === "dormant") {
      dormantNew.push(entry.id);
    }
    adjusted.push({
      knowledge_id: entry.id,
      confidence_before: entry.confidence,
      confidence_after: result.confidence,
      demerit_before: entry.demerit,
      demerit_after: result.demerit,
      tier_before: result.tier_before,
      tier_after: result.tier_after,
      tier_transition: result.tier_transition,
      delta_breakdown: result.delta_breakdown
    });
    deps.bus?.emit({
      source: "calibrator",
      action: "v2_adjusted",
      target: { id: entry.id },
      before: { confidence: entry.confidence, tier: entry.current_tier, demerit: entry.demerit },
      after: { confidence: result.confidence, tier: result.tier_after, demerit: result.demerit },
      severity: result.tier_after === "dormant" ? "warning" : "info",
      userFacingValue: result.tier_transition ? `${entry.id}: ${result.tier_before} \u2192 ${result.tier_after} (${result.tier_transition.reason})` : `${entry.id}: conf ${entry.confidence.toFixed(2)} \u2192 ${result.confidence.toFixed(2)}`,
      timestamp: now.toISOString()
    });
  }
  return { scanned: entries.length, adjusted, dormantNew };
}
function indexByKnowledgeId(items) {
  const m = /* @__PURE__ */ new Map();
  for (const it of items) {
    if (!it.knowledge_id) continue;
    const list = m.get(it.knowledge_id);
    if (list) list.push(it);
    else m.set(it.knowledge_id, [it]);
  }
  return m;
}
var TIER_RANK = {
  experimental: 0,
  probation: 1,
  stable: 2,
  canonical: 3,
  enforced: 4,
  dormant: -1
};
function tierRankGt(a, b) {
  return (TIER_RANK[a] ?? -1) > (TIER_RANK[b] ?? -1);
}
function isPromotion(from, to) {
  if (from === "dormant" || to === "dormant") return false;
  return tierRankGt(to, from);
}
var L1_GATED_TIERS = /* @__PURE__ */ new Set(["stable", "canonical", "enforced"]);
var L2_GATED_TIERS = /* @__PURE__ */ new Set(["canonical", "enforced"]);
var STABLE_PLUS = /* @__PURE__ */ new Set(["stable", "canonical", "enforced"]);
function syntheticOutcomeForEvent(kind) {
  if (kind === "hook-pre.blocked" || kind === "ai.override.complied" || kind === "ai.narrative.complied") {
    return "success";
  }
  if (kind === "ai.override.ignored" || kind === "ai.override.blocked_circumvented" || kind === "ai.narrative.recurred") {
    return "failure";
  }
  return null;
}
function overrideTier(result, revertTo, reason) {
  return {
    ...result,
    tier_after: revertTo,
    tier_transition: null,
    delta_breakdown: [
      ...result.delta_breakdown,
      {
        type: "tier_transition",
        note: `reverted to ${revertTo}: ${reason}`
      }
    ]
  };
}

// ../core/src/pipeline/ingest-pipeline.ts
init_esm_shims();
async function runIngestPipeline(deps) {
  const accepted = [];
  const rejected = [];
  let skipped = 0;
  let failed = 0;
  for (const input of deps.inputs) {
    let partial = null;
    try {
      partial = await deps.extractor.extract(input, deps.callLLM);
    } catch {
      failed += 1;
      emit2(deps.bus, {
        source: "ingest",
        action: "failed",
        target: { count: 1 },
        severity: "warning",
        userFacingValue: `\u63D0\u53D6\u5931\u8D25\uFF08kind=${input.kind}\uFF09`,
        timestamp: deps.now().toISOString()
      });
      continue;
    }
    if (!partial) {
      skipped += 1;
      emit2(deps.bus, {
        source: "ingest",
        action: "skipped",
        target: { count: 1 },
        severity: "info",
        userFacingValue: `\u4FE1\u53F7\u4E0D\u8DB3\uFF0C\u672A\u63D0\u53D6\uFF08kind=${input.kind}\uFF09`,
        timestamp: deps.now().toISOString()
      });
      continue;
    }
    const entry = completeEntry(partial, input, deps);
    const l0 = deps.validator.validateLevel0({
      entry,
      sourceText: input.context,
      existingRules: deps.store.getAll().map((r) => ({
        id: r.id,
        trigger: r.trigger,
        wrong_pattern: r.wrong_pattern
      })),
      projectStack: deps.projectStack
    });
    if (!l0.ok) {
      rejected.push({ entry, reasons: l0.failed_checks });
      emit2(deps.bus, {
        source: "ingest",
        action: "rejected_l0",
        target: { id: entry.id },
        severity: "info",
        userFacingValue: `L0 \u62D2\u7EDD\uFF1A${l0.failed_checks.join(", ")}`,
        timestamp: deps.now().toISOString()
      });
      continue;
    }
    if (!deps.dryRun) {
      if (deps.store.addWithEmbedding) {
        await deps.store.addWithEmbedding(entry);
      } else {
        deps.store.add(entry);
      }
    }
    accepted.push(entry);
    emit2(deps.bus, {
      source: "ingest",
      action: "accepted",
      target: { id: entry.id },
      severity: "highlight",
      userFacingValue: `\u5165\u5E93\uFF1A${entry.trigger}`,
      timestamp: deps.now().toISOString()
    });
  }
  return {
    scanned: deps.inputs.length,
    accepted,
    rejected,
    skipped,
    failed
  };
}
function completeEntry(partial, input, deps) {
  const nowIso = deps.now().toISOString();
  const nature = partial.nature ?? "subjective";
  const confidence = partial.confidence ?? Math.max(0, Math.min(1, input.weight));
  return {
    id: partial.id ?? deps.idGen(),
    scope: partial.scope ?? deps.scope,
    category: partial.category ?? "E",
    tags: partial.tags ?? [],
    type: partial.type ?? "avoidance",
    nature,
    trigger: partial.trigger ?? "",
    wrong_pattern: partial.wrong_pattern ?? "",
    correct_pattern: partial.correct_pattern ?? "",
    reasoning: partial.reasoning ?? "",
    confidence,
    enforcement: partial.enforcement ?? computeEnforcement(confidence, nature),
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: {
      success_sessions: 0,
      success_users: 0,
      correction_sessions: 0
    },
    created_at: nowIso,
    last_hit_at: "",
    last_validated_at: nowIso,
    source: deps.source,
    conflict_with: [],
    current_tier: "experimental",
    max_tier_ever: "experimental",
    tier_entered_at: nowIso,
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0,
    channel: "tool-action"
  };
}
function emit2(bus, event) {
  if (!bus) return;
  try {
    bus.emit(event);
  } catch {
  }
}

// ../core/src/validator/index.ts
init_esm_shims();

// ../core/src/validator/l0.ts
init_esm_shims();
var IMPORT_PATH_RE = /^[@a-zA-Z0-9_\-./]+$/;
function validateLevel0(input) {
  const failed = [];
  const { entry, sourceText, existingRules, projectStack } = input;
  const L0_MIN_TOKEN = 3;
  if (entry.type === "avoidance" && entry.wrong_pattern) {
    const patterns = entry.wrong_pattern.split("|").map((s) => s.trim()).filter((s) => s.length >= L0_MIN_TOKEN);
    const hit = patterns.length > 0 && patterns.some((p) => sourceText.includes(p));
    if (!hit) failed.push("wrong_pattern_not_in_source");
  }
  const importPath = entry.correct_pattern_import_path;
  if (typeof importPath === "string" && !IMPORT_PATH_RE.test(importPath)) {
    failed.push("invalid_import_path_format");
  }
  const fileTypes = entry.scope?.file_types;
  if (fileTypes && fileTypes.length > 0 && projectStack.length > 0) {
    const normalized = fileTypes.map((s) => s.replace(/^\*?\.?/, ""));
    const overlap = normalized.some((t) => projectStack.includes(t));
    if (!overlap) failed.push("file_types_stack_mismatch");
  }
  if (entry.trigger) {
    const exists = existingRules.some(
      (r) => r.id !== entry.id && r.trigger === entry.trigger
    );
    if (exists) failed.push("trigger_collision");
  }
  if (entry.type === "avoidance") {
    const paths = entry.scope?.paths;
    if (!paths || paths.length === 0) {
      failed.push("scope_paths_empty");
    } else {
      const malformed = paths.some((p) => typeof p !== "string" || p.length === 0);
      if (malformed) failed.push("scope_paths_malformed");
    }
  }
  if (entry.type === "practice" && entry.wrong_pattern) {
    failed.push("practice_must_not_have_wrong_pattern");
  }
  if (entry.type === "avoidance" && !entry.wrong_pattern) {
    failed.push("avoidance_must_have_wrong_pattern");
  }
  return {
    ok: failed.length === 0,
    failed_checks: failed,
    notes: failed.length ? `L0 failed: ${failed.join(", ")}` : void 0
  };
}

// ../core/src/validator/l1.ts
init_esm_shims();
async function validateLevel1(input, callLLM) {
  const prompt = buildL1Prompt(input);
  let raw;
  try {
    raw = await callLLM(prompt);
  } catch (e) {
    return {
      ok: false,
      confidence: 0,
      reason: `llm_error: ${truncate3(String(e), 120)}`
    };
  }
  return parseLLMValidation(raw);
}
function buildL1Prompt(input) {
  const entry = input.entry;
  return [
    "\u4F60\u662F\u89C4\u5219\u8D28\u91CF\u5BA1\u67E5\u5B98\uFF08L1\uFF0CHaiku \u7EA7\u8F7B\u91CF\u8BED\u4E49\u68C0\u67E5\uFF09\u3002",
    "\u8BF7\u5224\u65AD\u8FD9\u6761\u89C4\u5219\u662F\u5426\u8DB3\u591F specific\uFF0C\u4EE5\u53CA\u662F\u5426\u4E0E\u8FD1\u90BB\u89C4\u5219\u660E\u663E\u51B2\u7A81\u3002",
    "",
    "\u3010\u5F85\u5BA1\u89C4\u5219\u3011",
    JSON.stringify(
      {
        trigger: entry.trigger,
        wrong_pattern: entry.wrong_pattern,
        correct_pattern: entry.correct_pattern,
        reasoning: entry.reasoning,
        scope: entry.scope
      },
      null,
      2
    ),
    "",
    "\u3010\u8FD1\u90BB\u89C4\u5219\uFF08\u53EC\u56DE top-k\uFF09\u3011",
    input.similarRules.length > 0 ? input.similarRules.map((r) => `- ${r.id}: ${r.trigger}`).join("\n") : "(\u65E0)",
    "",
    "\u3010\u8F93\u51FA\u8981\u6C42\u3011",
    "\u4E25\u683C\u8F93\u51FA\u4E00\u6BB5 JSON\uFF08\u53EF\u5305\u88F9\u5728 ```json fenced block \u91CC\uFF09\uFF1A",
    '{"ok": true|false, "confidence": 0-1, "reason": "\u4E00\u4E24\u53E5\u4EBA\u8BDD", "conflicts_with": ["id1"]}',
    "- ok=false \u65F6 reason \u5FC5\u987B\u8BF4\u660E\u4E3A\u4EC0\u4E48",
    "- confidence \u662F\u4F60\u5BF9\u672C\u5224\u65AD\u7684\u628A\u63E1\u5EA6\uFF08\u4E0D\u662F\u89C4\u5219\u81EA\u8EAB\u7684 confidence\uFF09"
  ].join("\n");
}
function parseLLMValidation(raw) {
  const stripped = raw.trim().replace(/^```(?:json)?\s*\n?|\n?```$/g, "");
  let obj;
  try {
    obj = JSON.parse(stripped);
  } catch {
    return {
      ok: false,
      confidence: 0,
      reason: "llm_response_unparseable"
    };
  }
  if (!obj || typeof obj !== "object") {
    return { ok: false, confidence: 0, reason: "llm_response_not_object" };
  }
  const o = obj;
  const ok = typeof o.ok === "boolean" ? o.ok : false;
  const confidence = typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0;
  const reason = typeof o.reason === "string" && o.reason.trim() ? o.reason : "no_reason";
  const conflicts = Array.isArray(o.conflicts_with) ? o.conflicts_with.filter((x) => typeof x === "string") : void 0;
  return {
    ok,
    confidence,
    reason,
    ...conflicts && conflicts.length > 0 ? { conflicts_with: conflicts } : {}
  };
}
function truncate3(s, max) {
  return s.length > max ? s.slice(0, max) + "\u2026" : s;
}

// ../core/src/validator/l2.ts
init_esm_shims();
async function validateLevel2(input, callLLM) {
  const prompt = buildL2Prompt(input);
  let raw;
  try {
    raw = await callLLM(prompt);
  } catch (e) {
    return {
      ok: false,
      confidence: 0,
      reason: `llm_error: ${String(e).slice(0, 120)}`
    };
  }
  return parseLLMValidation(raw);
}
function buildL2Prompt(input) {
  const entry = input.entry;
  const samples = input.recentHits.slice(0, 20);
  return [
    "\u4F60\u662F\u89C4\u5219\u8D28\u91CF\u5BA1\u67E5\u5B98\uFF08L2\uFF0CSonnet \u7EA7\u6DF1\u5EA6\u68C0\u67E5\uFF09\u3002",
    "\u76EE\u6807\uFF1A\u5224\u65AD\u8FD9\u6761\u89C4\u5219\u664B\u5347\u5230 canonical/enforced \u7EA7\u522B\u662F\u5426\u5408\u9002\u3002",
    "",
    "\u4E3B\u8981\u5224\u522B\u4E24\u4EF6\u4E8B\uFF1A",
    "  1) \u8FC7\u62DF\u5408\uFF1A\u6837\u672C tool_input \u662F\u5426\u90FD\u662F\u540C\u4E00\u7C7B\u9879\u76EE/\u540C\u4E00\u7C7B\u60C5\u5F62\uFF1F\u82E5\u662F\uFF0C\u89C4\u5219\u53EF\u80FD\u5BF9\u5176\u5B83\u573A\u666F\u8BEF\u62E6\u3002",
    "  2) \u5197\u4F59\uFF1A\u662F\u5426\u4E0E\u67D0\u6761\u5DF2\u6709 senior \u89C4\u5219\u672C\u8D28\u4E0A\u91CD\u590D\uFF08\u540C trigger \u540C pattern\uFF09\uFF1F",
    "",
    "\u3010\u5F85\u5BA1\u89C4\u5219\u3011",
    JSON.stringify(
      {
        id: entry.id,
        trigger: entry.trigger,
        wrong_pattern: entry.wrong_pattern,
        correct_pattern: entry.correct_pattern,
        reasoning: entry.reasoning,
        scope: entry.scope,
        current_tier: entry.current_tier
      },
      null,
      2
    ),
    "",
    "\u3010\u6700\u8FD1 20 \u6B21\u547D\u4E2D\u7684 tool_input \u6837\u672C\u3011",
    samples.length > 0 ? samples.map(
      (s, i) => `${i + 1}. [${s.timestamp}] ${truncate4(JSON.stringify(s.tool_input ?? null), 160)}`
    ).join("\n") : "(\u65E0\u6837\u672C)",
    "",
    "\u3010\u5DF2\u6709 senior \u89C4\u5219\uFF08canonical/enforced\uFF09\u3011",
    input.existingSeniorRules.length > 0 ? input.existingSeniorRules.map((r) => `- ${r.id} [${r.current_tier}]: ${r.trigger}`).join("\n") : "(\u65E0)",
    "",
    "\u3010\u8F93\u51FA\u8981\u6C42\u3011",
    "\u4E25\u683C\u8F93\u51FA\u4E00\u6BB5 JSON\uFF08\u53EF\u5305\u88F9\u5728 ```json fenced block \u91CC\uFF09\uFF1A",
    '{"ok": true|false, "confidence": 0-1, "reason": "\u4E00\u4E24\u53E5\u4EBA\u8BDD", "conflicts_with": ["id1"]}',
    "- \u82E5\u5224\u5B9A\u8FC7\u62DF\u5408\u6216\u5197\u4F59\uFF0Cok=false \u4E14 reason \u6307\u660E\u54EA\u4E2A",
    "- confidence \u662F\u4F60\u5BF9\u672C\u5224\u65AD\u7684\u628A\u63E1\u5EA6"
  ].join("\n");
}
function truncate4(s, max) {
  return s.length > max ? s.slice(0, max) + "\u2026" : s;
}

// ../core/src/validator/index.ts
var defaultValidator = {
  validateLevel0,
  validateLevel1,
  validateLevel2
};

// ../core/src/compiler/agent-skill.ts
init_esm_shims();
var MAX_DESCRIPTION_LENGTH = 400;
function formatAsAgentSkill(entry) {
  const summary = entry.reasoning.length > MAX_DESCRIPTION_LENGTH ? entry.reasoning.slice(0, MAX_DESCRIPTION_LENGTH - 1) + "\u2026" : entry.reasoning;
  const frontmatter = [
    "---",
    `name: ${entry.id}`,
    `description: >`,
    `  ${summary}`,
    `  \u4F7F\u7528\u573A\u666F\uFF1A${entry.trigger}`,
    `  \u89E6\u53D1\u5173\u952E\u8BCD\uFF1A${entry.trigger}`,
    "---"
  ].join("\n");
  const body = [
    "## \u80CC\u666F",
    "",
    entry.reasoning,
    "",
    "## \u505A\u6CD5",
    "",
    "### \u2705 \u6B63\u786E",
    "",
    entry.correct_pattern
  ];
  if (entry.wrong_pattern) {
    body.push("", "### \u274C \u9519\u8BEF", "", entry.wrong_pattern);
  }
  body.push(
    "",
    "## \u5143\u4FE1\u606F",
    "",
    `- Rule ID: ${entry.id}`,
    `- Tier: ${entry.current_tier}`,
    `- Confidence: ${entry.confidence.toFixed(2)}`,
    `- Source: ${entry.source}`
  );
  return frontmatter + "\n\n" + body.join("\n") + "\n";
}

// ../core/src/pipeline/compile-pipeline.ts
init_esm_shims();
async function runCompile(deps) {
  const entries = deps.store.getAll();
  let mdPath = "(dry-run)";
  let mdLineCount = 0;
  if (!deps.dryRun) {
    const info = deps.markdownCompiler.writeToFile(entries);
    mdPath = info.filePath;
    mdLineCount = info.blockLineCount;
  }
  const artifacts = deps.skillCompiler.compile(entries);
  const written = deps.dryRun ? artifacts.map((a) => a.ruleId) : (await deps.skillCompiler.write(artifacts)).written;
  const toRemove = deps.skillEvents?.filter((e) => e.action === "skill_should_remove").map((e) => e.id) ?? [];
  const removed = deps.dryRun ? toRemove : (await deps.skillCompiler.cleanup(toRemove)).removed;
  deps.bus?.emit({
    source: "compile",
    action: "markdown_compiled",
    target: { id: mdPath },
    severity: "info",
    userFacingValue: `CLAUDE.md: ${mdLineCount} lines, skills written: ${written.length}, removed: ${removed.length}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  return {
    markdown: { path: mdPath, blockLineCount: mdLineCount },
    skills: { written, removed }
  };
}

// ../core/src/pipeline/override-signal.ts
init_esm_shims();
function detectIgnoredSignals(currentToolUseId, recentEvents) {
  return recentEvents.filter(
    (e) => e.kind === "hook-pre.warned" && e.tool_use_id === currentToolUseId && Boolean(e.knowledge_id)
  ).map((e) => ({ knowledge_id: e.knowledge_id }));
}
function detectBlockedCircumventedSignals(currentToolName, recentEvents, now, windowMs = 3e5) {
  const cutoff = now.getTime() - windowMs;
  const alreadyEmitted = /* @__PURE__ */ new Set();
  for (const e of recentEvents) {
    if (e.kind === "ai.override.blocked_circumvented" && e.knowledge_id) {
      alreadyEmitted.add(e.knowledge_id);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const e of recentEvents) {
    if (e.kind === "hook-pre.blocked" && e.knowledge_id && e.tool_name === currentToolName && new Date(e.timestamp).getTime() > cutoff && !alreadyEmitted.has(e.knowledge_id) && !seen.has(e.knowledge_id)) {
      seen.add(e.knowledge_id);
      result.push({ knowledge_id: e.knowledge_id });
    }
  }
  return result;
}
function detectCompliedSignals(currentToolName, recentEvents, now, windowMs = 3e5) {
  const cutoff = now.getTime() - windowMs;
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const e of recentEvents) {
    if (e.kind === "hook-pre.warned" && e.knowledge_id && e.tool_name === currentToolName && new Date(e.timestamp).getTime() > cutoff && !seen.has(e.knowledge_id)) {
      seen.add(e.knowledge_id);
      result.push({ knowledge_id: e.knowledge_id });
    }
  }
  return result;
}

// ../core/src/error-collector/cross-session-cluster.ts
init_esm_shims();
function clusterByTag(signals, minSessions, now) {
  if (signals.length === 0) return [];
  const keywordSessions = /* @__PURE__ */ new Map();
  for (const sig of signals) {
    const tokens = tokenize(sig.context);
    const sessionId = sig.sessionIds[0] ?? "unknown";
    for (const token of tokens) {
      if (!keywordSessions.has(token)) {
        keywordSessions.set(token, /* @__PURE__ */ new Set());
      }
      keywordSessions.get(token).add(sessionId);
    }
  }
  const result = [];
  for (const [keyword, sessionSet] of keywordSessions.entries()) {
    if (sessionSet.size < minSessions) continue;
    const sessionIds = Array.from(sessionSet);
    const matchingSignals = signals.filter(
      (s) => s.context.toLowerCase().includes(keyword)
    );
    const weight = Math.min(sessionSet.size / 5, 1);
    const contextSummary = [
      `[H \u805A\u7C7B] \u5173\u952E\u8BCD "${keyword}" \u5728 ${sessionSet.size} \u4E2A\u4E0D\u540C session \u4E2D\u91CD\u590D\u51FA\u73B0`,
      `\u76F8\u5173\u4E0A\u4E0B\u6587\u7247\u6BB5\uFF1A`,
      ...matchingSignals.slice(0, 3).map((s) => `  - ${s.context.slice(0, 120)}`)
    ].join("\n");
    result.push({
      id: `h-${keyword}-${sessionIds.slice(0, 3).join("-")}`,
      signalType: "H",
      weight,
      sessionIds,
      context: contextSummary,
      suggestedCategory: void 0,
      timestamp: now.toISOString()
    });
  }
  return result;
}
var STOP_WORDS = /* @__PURE__ */ new Set([
  // 通用英文虚词
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "have",
  "been",
  "were",
  "they",
  "their",
  "there",
  "when",
  "what",
  "which",
  "will",
  "also",
  "into",
  "more",
  "some",
  "then",
  "than",
  "these",
  "those",
  "such",
  "your",
  "about",
  "after",
  "before",
  // session compaction 摘要高频词（防止 H 聚类把元信息当错误模式）
  "session",
  "conversation",
  "context",
  "summary",
  "previous",
  "continued",
  "earlier",
  "portion",
  "covers",
  "below",
  "request",
  "intent",
  "primary",
  "being",
  "user",
  // 错误类通用词（太宽泛，无区分度）
  "error",
  "fail",
  "failed",
  "failure",
  "could",
  "would",
  "should"
]);
function tokenize(text) {
  return text.toLowerCase().split(/[\s\-_./\\:,;()[\]{}'"!?\uff01\uff0c\uff1a\uff1b\u3001\u3002]+/).filter((t) => t.length >= 4 && !STOP_WORDS.has(t) && !isLabelToken(t));
}
function isLabelToken(t) {
  return /^[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+$/.test(t);
}

// ../core/src/error-collector/signal-filter.ts
init_esm_shims();
function filterSignals(signals, opts) {
  if (signals.length === 0) return [];
  const dedupMap = /* @__PURE__ */ new Map();
  for (const sig of signals) {
    const existing = dedupMap.get(sig.id);
    if (!existing || sig.weight > existing.weight) {
      dedupMap.set(sig.id, sig);
    }
  }
  return Array.from(dedupMap.values()).filter((sig) => {
    if (sig.weight < opts.weightThreshold) return false;
    if (sig.signalType !== "H") {
      const uniqueSessions = new Set(sig.sessionIds).size;
      if (uniqueSessions < opts.minSessions) return false;
    }
    return true;
  });
}

// ../core/src/error-collector/error-batch-builder.ts
init_esm_shims();

// ../core/src/error-collector/error-extraction-prompt.ts
init_esm_shims();
function buildBatchErrorExtractionPrompt(signals, category) {
  const categoryDesc = {
    C: "\u4EE3\u7801\u5C42\uFF08\u8BED\u6CD5\u3001\u7C7B\u578B\u3001API \u7528\u6CD5\uFF09",
    E: "\u5DE5\u7A0B\u5C42\uFF08\u67B6\u6784\u3001\u4F9D\u8D56\u3001\u5DE5\u5177\u94FE\u3001\u6784\u5EFA\uFF09",
    S: "\u7B56\u7565\u5C42\uFF08\u4EFB\u52A1\u5206\u89E3\u3001\u5B9E\u73B0\u987A\u5E8F\u3001\u53D6\u820D\uFF09",
    K: "\u8BA4\u77E5\u5C42\uFF08\u7528\u6237\u504F\u597D\u3001\u5FC3\u667A\u6A21\u578B\u3001\u534F\u4F5C\u65B9\u5F0F\uFF09"
  };
  const signalBlock = signals.map(
    (s, i) => `--- \u4FE1\u53F7 ${i + 1} [${s.signalType}] weight=${s.weight.toFixed(2)} sessions=${s.sessionIds.length} ---
${s.context.trim()}`
  ).join("\n\n");
  return `\u4F60\u662F\u77E5\u8BC6\u63D0\u53D6\u5668\u3002\u4E0B\u9762\u662F ${signals.length} \u6761\u6765\u81EA\u5F00\u53D1\u8FC7\u7A0B\u7684\u9519\u8BEF\u4FE1\u53F7\uFF0C\u7C7B\u522B\u4E3A ${category}\uFF08${categoryDesc[category]}\uFF09\u3002

\u8BF7\u5206\u6790\u8FD9\u4E9B\u4FE1\u53F7\uFF0C\u63D0\u70BC\u51FA 1-3 \u6761\u6709\u4EF7\u503C\u7684"\u77E5\u8BC6\u6761\u76EE"\uFF08\u5982\u679C\u4FE1\u53F7\u592A\u5F31\u6216\u5185\u5BB9\u91CD\u590D\uFF0C\u63D0\u70BC\u66F4\u5C11\u6761\u751A\u81F3 0 \u6761\uFF09\u3002

\u3010\u9519\u8BEF\u4FE1\u53F7\u3011
${signalBlock}

\u3010\u8F93\u51FA\u5B57\u6BB5\uFF08\u6BCF\u6761\u77E5\u8BC6\u6761\u76EE\uFF09\u3011
- category: "${category}"\uFF08\u56FA\u5B9A\uFF09
- tags: string[] \u81EA\u7531\u6807\u7B7E\uFF0C2-5 \u4E2A\u77ED\u8BCD
- type: "avoidance" | "practice"
- nature: "objective" | "subjective"
- trigger: string \u4F55\u65F6\u751F\u6548\uFF0C\u901A\u7528\u573A\u666F\u63CF\u8FF0
- wrong_pattern: string \u9519\u8BEF\u505A\u6CD5\u5173\u952E\u5B57\uFF1B\u4E0D\u9002\u7528\u586B ""
- correct_pattern: string \u6B63\u786E\u505A\u6CD5\u4E00\u53E5\u8BDD
- reasoning: string \u4E00\u53E5\u8BDD\u89E3\u91CA\u539F\u56E0

\u3010\u4E25\u683C\u8981\u6C42\u3011
1. \u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u6570\u7EC4\uFF08\u5728 \`\`\`json fenced block \u91CC\uFF09\uFF0C\u6570\u7EC4\u5143\u7D20\u662F 0-3 \u4E2A\u77E5\u8BC6\u6761\u76EE\u5BF9\u8C61
2. \u5982\u679C\u6240\u6709\u4FE1\u53F7\u90FD\u592A\u5F31\u6216\u592A\u79C1\u4EBA\u5316\uFF0C\u8F93\u51FA\u7A7A\u6570\u7EC4 \`[]\`
3. \u4E0D\u8981\u8F93\u51FA\u9664 JSON \u4EE5\u5916\u7684\u4EFB\u4F55\u6587\u5B57

\u3010\u793A\u4F8B\u8F93\u51FA\u3011
\`\`\`json
[
  {
    "category": "E",
    "tags": ["vitest", "windows", "concurrency"],
    "type": "avoidance",
    "nature": "objective",
    "trigger": "\u5728 Windows \u73AF\u5883\u4E0B\u914D\u7F6E vitest",
    "wrong_pattern": "fileParallelism: true",
    "correct_pattern": "fileParallelism: false",
    "reasoning": "Windows \u4E0B vitest \u5E76\u53D1\u6A21\u5F0F\u4F1A\u5BFC\u81F4 OOM\uFF0C\u5FC5\u987B\u987A\u5E8F\u8DD1"
  }
]
\`\`\``;
}

// ../core/src/error-collector/error-batch-builder.ts
function buildErrorBatches(signals) {
  if (signals.length === 0) return [];
  const groups = /* @__PURE__ */ new Map();
  for (const sig of signals) {
    const cat = sig.suggestedCategory ?? "E";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(sig);
  }
  return Array.from(groups.entries()).map(([category, sigs]) => ({
    category,
    signals: sigs,
    prompt: buildBatchErrorExtractionPrompt(sigs, category)
  }));
}

// ../core/src/update/update-state.ts
init_esm_shims();
function defaultUpdateState() {
  return {
    last_check_ts: 0,
    interval_hours: 1,
    last_installed_sha: "",
    last_installed_version: "",
    installed_at: 0,
    consecutive_install_failures: 0,
    last_install_error: null,
    pending_banner: null
  };
}
function parseUpdateState(raw) {
  const def = defaultUpdateState();
  if (!raw || !raw.trim()) return def;
  try {
    const obj = JSON.parse(raw);
    return {
      last_check_ts: typeof obj.last_check_ts === "number" ? obj.last_check_ts : def.last_check_ts,
      interval_hours: typeof obj.interval_hours === "number" ? obj.interval_hours : def.interval_hours,
      last_installed_sha: typeof obj.last_installed_sha === "string" ? obj.last_installed_sha : def.last_installed_sha,
      last_installed_version: typeof obj.last_installed_version === "string" ? obj.last_installed_version : def.last_installed_version,
      installed_at: typeof obj.installed_at === "number" ? obj.installed_at : def.installed_at,
      consecutive_install_failures: typeof obj.consecutive_install_failures === "number" ? obj.consecutive_install_failures : def.consecutive_install_failures,
      last_install_error: typeof obj.last_install_error === "string" ? obj.last_install_error : null,
      pending_banner: isPendingBanner(obj.pending_banner) ? obj.pending_banner : null
    };
  } catch {
    return def;
  }
}
function serializeUpdateState(s) {
  return JSON.stringify(s, null, 2);
}
function isPendingBanner(v) {
  if (!v || typeof v !== "object") return false;
  const o = v;
  return typeof o.from === "string" && typeof o.to === "string" && typeof o.at === "number" && typeof o.shown === "boolean";
}

// ../core/src/update/should-check.ts
init_esm_shims();
var FAILURE_BACKOFF_MS = 24 * 60 * 60 * 1e3;
var FAILURE_THRESHOLD = 3;
function shouldCheckUpdate(input) {
  if (input.env.TEAMAGENT_AUTO_UPDATE === "0") return false;
  if (input.disabledMarkerExists) return false;
  const { state, now } = input;
  if (state.consecutive_install_failures >= FAILURE_THRESHOLD && now - state.last_check_ts < FAILURE_BACKOFF_MS) {
    return false;
  }
  const intervalMs = (state.interval_hours || 1) * 60 * 60 * 1e3;
  return now - state.last_check_ts >= intervalMs;
}

// ../core/src/narrative-scanner/index.ts
init_esm_shims();

// ../core/src/narrative-scanner/scan.ts
init_esm_shims();
var MIN_ASCII_TOKEN_LENGTH = 3;
var MIN_CJK_TOKEN_LENGTH = 2;
function splitPatterns2(raw) {
  const tokens = [];
  for (const piece of raw.split("|")) {
    const t = piece.trim();
    if (t.length === 0) continue;
    const hasNonAscii = /[^\x00-\x7f]/.test(t);
    const min = hasNonAscii ? MIN_CJK_TOKEN_LENGTH : MIN_ASCII_TOKEN_LENGTH;
    if (t.length >= min) tokens.push(t);
  }
  return tokens;
}
function snippet(haystack, needle, pad = 20) {
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return needle;
  const start = Math.max(0, idx - pad);
  const end = Math.min(haystack.length, idx + needle.length + pad);
  return haystack.slice(start, end);
}
function summarize(rule) {
  return rule.correct_pattern || rule.reasoning || rule.wrong_pattern || rule.id;
}
function scanNarrative(text, rules) {
  if (!text) return [];
  if (rules.length === 0) return [];
  const hits = [];
  const lower = text.toLowerCase();
  for (const rule of rules) {
    if (rule.status !== "active") continue;
    if (!rule.wrong_pattern) continue;
    if (normalizeChannel(rule.channel) !== "ai-narrative") continue;
    const patterns = splitPatterns2(rule.wrong_pattern);
    for (const p of patterns) {
      if (p.length === 0) continue;
      if (lower.includes(p.toLowerCase())) {
        hits.push({
          knowledge_id: rule.id,
          matched_snippet: snippet(text, p),
          rule_summary: summarize(rule),
          confidence: rule.confidence,
          correct_pattern: rule.correct_pattern,
          reasoning: rule.reasoning
        });
        break;
      }
    }
  }
  return hits;
}

// ../core/src/narrative-scanner/pending-warnings.ts
init_esm_shims();
function formatPendingRecord(hit, ctx) {
  return {
    session_id: ctx.session_id,
    turn_index: ctx.turn_index,
    knowledge_id: hit.knowledge_id,
    matched_snippet: hit.matched_snippet,
    rule_summary: hit.rule_summary,
    confidence: hit.confidence,
    correct_pattern: hit.correct_pattern,
    reasoning: hit.reasoning,
    at: ctx.at
  };
}
function mergePending(existing, incoming) {
  const key = (p) => `${p.session_id}|${p.turn_index}|${p.knowledge_id}`;
  const seen = new Set(existing.map(key));
  const out = [...existing];
  for (const p of incoming) {
    if (!seen.has(key(p))) {
      out.push(p);
      seen.add(key(p));
    }
  }
  return out;
}
function selectTopForInjection(pending, max) {
  return [...pending].sort((a, b) => b.confidence - a.confidence).slice(0, max);
}
function formatInjectionText(warnings) {
  if (warnings.length === 0) return "";
  const lines = [
    "\u25C8 TeamAgent observation from previous turn",
    "In your previous reply the following patterns triggered team rules:"
  ];
  for (const w of warnings) {
    const hint = w.correct_pattern || w.reasoning || w.rule_summary;
    lines.push(
      `- "${w.matched_snippet.trim()}" (rule ${w.knowledge_id}, conf ${w.confidence.toFixed(2)}): ${hint}`
    );
  }
  lines.push("Please avoid such phrasing this turn and proceed based on evidence.");
  return lines.join("\n");
}

export {
  scoreEntry,
  BLOCK_START,
  BLOCK_END,
  compileMarkdownBlock,
  injectBlockIntoDoc,
  matchRules,
  matchRules2,
  DEFAULT_SOFTAND,
  scoreSoftAnd,
  semanticMatch,
  confidenceWeight,
  rerankByConfidence,
  MAX_HARD_NEG,
  accumulateHardNegative,
  ruleBasedCorrectionDetector,
  ruleBasedSuccessDetector,
  parseSessionFile,
  buildExtractionPrompt,
  buildRetrofitPrompt,
  extractRuleBullets,
  extractCursorRules,
  llmBasedKnowledgeExtractor,
  parseExtractionResponse,
  structureRuleText,
  DEFAULT_IMPORT_CONFIDENCE,
  structureRuleTextsBatch,
  detectStack,
  getMetaPrinciples,
  DEFAULT_MARKETPLACES,
  DEFAULT_PLUGINS,
  parsePluginSpec,
  formatPluginSpec,
  defaultCalibrator,
  runCalibrationPipeline,
  buildSemanticDescriptions,
  momentSignature,
  runExtractPipeline,
  formatCorrectionContext,
  DEFAULT_CODE_FILE_TYPES,
  runScenario,
  runVerify,
  entryFromPartial,
  v2Calibrator,
  runCalibrationPipelineV2,
  runIngestPipeline,
  validateLevel0,
  validateLevel1,
  validateLevel2,
  defaultValidator,
  formatAsAgentSkill,
  runCompile,
  detectIgnoredSignals,
  detectBlockedCircumventedSignals,
  detectCompliedSignals,
  clusterByTag,
  filterSignals,
  buildErrorBatches,
  defaultUpdateState,
  parseUpdateState,
  serializeUpdateState,
  shouldCheckUpdate,
  scanNarrative,
  formatPendingRecord,
  mergePending,
  selectTopForInjection,
  formatInjectionText
};
