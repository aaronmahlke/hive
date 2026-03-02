import { createHighlighter, type Highlighter, type ThemedToken } from "shiki";
// @ts-ignore — pierre's theme is a valid VS Code theme JSON
import pierreDarkTheme from "../../node_modules/@pierre/diffs/dist/themes/pierre-dark.js";

const commonLanguages = [
  "javascript", "typescript", "jsx", "tsx",
  "html", "css", "scss", "json", "yaml", "toml", "xml",
  "bash", "shell", "sh", "zsh",
  "python", "rust", "go", "ruby", "java", "c", "cpp",
  "sql", "graphql", "markdown", "mdx",
  "vue", "svelte", "dockerfile", "diff",
  "text", "plaintext",
];

let highlighterPromise: Promise<Highlighter> | null = null;

function getDiffHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [pierreDarkTheme],
      langs: commonLanguages,
    });
  }
  return highlighterPromise;
}

export type Token = {
  content: string;
  color: string;
};

export async function tokenizeLine(code: string, lang: string): Promise<Token[]> {
  const hl = await getDiffHighlighter();
  const loaded = hl.getLoadedLanguages();
  const language = loaded.includes(lang) ? lang : "text";

  const result = hl.codeToTokens(code.replace(/\n$/, ""), {
    lang: language,
    theme: "pierre-dark",
  });

  return result.tokens[0]?.map((t: ThemedToken) => ({
    content: t.content,
    color: t.color || "#fbfbfb",
  })) ?? [{ content: code, color: "#fbfbfb" }];
}

/**
 * Tokenize a block of lines as a single unit, preserving cross-line
 * syntax state (multi-line strings, comments, template literals, etc.).
 *
 * Returns one Token[] per input line.
 */
export async function tokenizeBlock(lines: string[], lang: string): Promise<Token[][]> {
  if (!lines.length) return [];

  const hl = await getDiffHighlighter();
  const loaded = hl.getLoadedLanguages();
  const language = loaded.includes(lang) ? lang : "text";

  // Join all lines into a single string and tokenize at once.
  // Strip trailing \n from each line before joining so shiki sees clean line breaks.
  const fullText = lines.map((l) => l.replace(/\n$/, "")).join("\n");

  const result = hl.codeToTokens(fullText, {
    lang: language,
    theme: "pierre-dark",
  });

  // result.tokens is an array of token arrays, one per line
  return result.tokens.map((lineTokens: ThemedToken[]) =>
    lineTokens.map((t) => ({
      content: t.content,
      color: t.color || "#fbfbfb",
    })),
  );
}

export function getLangFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const name = filePath.split("/").pop()?.toLowerCase() || "";
  if (name === "dockerfile") return "dockerfile";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    vue: "vue", svelte: "svelte", html: "html", css: "css", scss: "scss",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", mdx: "mdx", py: "python", rs: "rust", go: "go",
    rb: "ruby", java: "java", c: "c", cpp: "cpp", h: "c", hpp: "cpp",
    sql: "sql", graphql: "graphql", sh: "bash", bash: "bash", zsh: "bash",
    xml: "xml", svg: "xml",
  };
  return map[ext] || "text";
}
