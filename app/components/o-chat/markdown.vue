<script lang="ts">
import { Marked } from "marked";
import markedShiki from "marked-shiki";
import DOMPurify from "dompurify";
import { createHighlighter, type Highlighter } from "shiki";

// True module-level singleton — shared across ALL component instances.
// This prevents creating 40+ Shiki highlighter instances when rendering
// a conversation with many code blocks.

const hiveTheme = {
  name: "hive",
  type: "dark" as const,
  settings: [],
  colors: {
    "editor.background": "transparent",
    "editor.foreground": "var(--text-color-primary)",
  },
  tokenColors: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "var(--text-color-tertiary)" } },
    { scope: ["string", "string.quoted"], settings: { foreground: "oklch(0.75 0.15 155)" } },
    { scope: ["keyword", "storage.type", "storage.modifier"], settings: { foreground: "oklch(0.7 0.17 300)" } },
    { scope: ["entity.name.function", "support.function"], settings: { foreground: "oklch(0.75 0.14 230)" } },
    { scope: ["entity.name.type", "support.type", "support.class"], settings: { foreground: "oklch(0.75 0.12 70)" } },
    { scope: ["variable", "variable.other"], settings: { foreground: "var(--text-color-primary)" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "oklch(0.75 0.14 50)" } },
    { scope: ["entity.name.tag"], settings: { foreground: "oklch(0.7 0.17 15)" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "oklch(0.75 0.14 230)" } },
    { scope: ["punctuation"], settings: { foreground: "var(--text-color-tertiary)" } },
    { scope: ["meta.property-name", "support.type.property-name"], settings: { foreground: "oklch(0.75 0.14 230)" } },
  ],
};

// Common languages for code highlighting — load these upfront instead of all 200+
const commonLanguages = [
  "javascript", "typescript", "jsx", "tsx",
  "html", "css", "scss",
  "json", "yaml", "toml", "xml",
  "bash", "shell", "sh", "zsh",
  "python", "rust", "go", "ruby", "java", "c", "cpp",
  "sql", "graphql",
  "markdown", "mdx",
  "vue", "svelte",
  "dockerfile", "diff",
  "text", "plaintext",
];

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [hiveTheme],
      langs: commonLanguages,
    });
  }
  return highlighterPromise;
}

const marked = new Marked();
let markedReady: Promise<void> | null = null;

function ensureMarked(): Promise<void> {
  if (!markedReady) {
    markedReady = getHighlighter().then((hl) => {
      marked.use(
        markedShiki({
          highlight(code, lang) {
            const language = lang && hl.getLoadedLanguages().includes(lang) ? lang : "text";
            return hl.codeToHtml(code, { lang: language, theme: "hive" });
          },
        }),
      );
    });
  }
  return markedReady;
}

async function renderMarkdown(text: string): Promise<string> {
  await ensureMarked();
  const raw = await marked.parse(text);
  return DOMPurify.sanitize(raw, {
    FORBID_TAGS: ["style"],
    ADD_ATTR: ["target"],
  });
}
</script>

<script setup lang="ts">
interface Props {
  content: string;
}

const { content } = defineProps<Props>();
const rendered = ref("");

watch(() => content, async (val) => {
  rendered.value = await renderMarkdown(val);
}, { immediate: true });
</script>

<template>
  <div class="o-markdown text-copy text-primary" v-html="rendered" />
</template>

<style>
.o-markdown {
  line-height: 1.65;
}

.o-markdown p {
  margin: 0.5em 0;
}

.o-markdown p:first-child {
  margin-top: 0;
}

.o-markdown p:last-child {
  margin-bottom: 0;
}

.o-markdown pre {
  background: var(--color-terminal);
  border: 1px solid var(--border-color-edge);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin: 0.75rem 0;
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.o-markdown pre code {
  background: none;
  padding: 0;
  border: none;
  font-size: inherit;
}

.o-markdown code {
  background: oklch(from var(--base) calc(l + var(--surface-1) * var(--dir)) c h);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.85em;
  font-family: var(--font-mono);
}

.o-markdown ul,
.o-markdown ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.o-markdown li {
  margin: 0.25em 0;
}

.o-markdown h1,
.o-markdown h2,
.o-markdown h3,
.o-markdown h4 {
  margin: 1em 0 0.5em;
  font-weight: 500;
}

.o-markdown h1 { font-size: 1.25em; }
.o-markdown h2 { font-size: 1.125em; }
.o-markdown h3 { font-size: 1em; }

.o-markdown blockquote {
  border-left: 2px solid var(--border-color-edge);
  padding-left: 0.75em;
  margin: 0.5em 0;
  color: var(--text-color-secondary);
}

.o-markdown a {
  color: var(--color-accent);
  text-decoration: underline;
  text-decoration-color: oklch(from var(--color-accent) l c h / 0.3);
}

.o-markdown a:hover {
  text-decoration-color: var(--color-accent);
}

.o-markdown hr {
  border: none;
  border-top: 1px solid var(--border-color-edge);
  margin: 1em 0;
}

.o-markdown table {
  border-collapse: collapse;
  margin: 0.75em 0;
  width: 100%;
  font-size: 0.875em;
}

.o-markdown th,
.o-markdown td {
  border: 1px solid var(--border-color-edge);
  padding: 0.375rem 0.75rem;
  text-align: left;
}

.o-markdown th {
  font-weight: 500;
  background: oklch(from var(--base) calc(l + var(--surface-1) * var(--dir)) c h);
}

/* Shiki code blocks already have their own styles, just override bg */
.o-markdown .shiki {
  background: transparent !important;
}
</style>
