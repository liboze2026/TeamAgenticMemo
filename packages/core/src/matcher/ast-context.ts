import { createRequire } from "node:module";
import { Parser, Language } from "web-tree-sitter";

const require = createRequire(import.meta.url);

let initialized = false;
// Pre-created parser per language (setLanguage already called)
const parsers = new Map<string, Parser>();

const WASM_MAP: Record<string, string> = {
  typescript: "tree-sitter-typescript/tree-sitter-typescript.wasm",
  javascript: "tree-sitter-typescript/tree-sitter-typescript.wasm",
  tsx: "tree-sitter-typescript/tree-sitter-tsx.wasm",
  python: "tree-sitter-python/tree-sitter-python.wasm",
};

/** 首次调用时初始化 web-tree-sitter WASM runtime + 预加载语言。幂等。 */
export async function initAstMatcher(): Promise<void> {
  if (initialized) return;

  await Parser.init({
    locateFile: (name: string) => require.resolve(`web-tree-sitter/${name}`),
  });

  for (const [lang, wasmRelPath] of Object.entries(WASM_MAP)) {
    if (parsers.has(lang)) continue;
    try {
      const fullPath = require.resolve(wasmRelPath);
      const language = await Language.load(fullPath);
      const parser = new Parser();
      parser.setLanguage(language);
      parsers.set(lang, parser);
    } catch {
      // 该语言 WASM 不可用，跳过（unknown lang 走 false 保守路径）
    }
  }

  initialized = true;
}

/**
 * 判断 `code` 中 `offset` 处是否落在 comment / string literal 内。
 * 落在 → 过滤（返回 true）；真代码或未知语言 → 不过滤（返回 false）。
 *
 * 同步 API；调用前须已 await initAstMatcher()。
 */
export function isInsideCommentOrString(
  code: string,
  offset: number,
  lang: string
): boolean {
  const parser = parsers.get(lang);
  if (!parser) return false; // 未知语言 → 保守：当作真命中，不过滤

  const tree = parser.parse(code);
  const node = tree.rootNode.descendantForIndex(offset);

  let cur: ReturnType<typeof tree.rootNode.descendantForIndex> | null = node;
  while (cur) {
    const t = cur.type;
    if (
      t === "comment" ||
      t === "line_comment" ||
      t === "block_comment" ||
      t === "string" ||
      t === "string_literal" ||
      t === "string_fragment" ||
      t === "template_string"
    ) {
      tree.delete();
      return true;
    }
    cur = cur.parent;
  }

  tree.delete();
  return false;
}
