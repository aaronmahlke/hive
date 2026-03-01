<script setup lang="ts">
import {
  EyeIcon,
  CodeBracketIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  DocumentPlusIcon,
  PencilSquareIcon,
  GlobeAltIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
} from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/16/solid";

type DynamicToolPart = {
  type: "dynamic-tool" | string;
  toolName: string;
  toolCallId: string;
  state: string;
  input?: any;
  output?: any;
  errorText?: string;
};

type Props = {
  tool: DynamicToolPart;
};

const { tool } = defineProps<Props>();
const expanded = ref(false);

type ToolDef = {
  icon: any;
  name: string;
  subtitle: (input: any) => string;
};

const toolDefs: Record<string, ToolDef> = {
  bash: { icon: CommandLineIcon, name: "Shell", subtitle: (a) => a?.description || (a?.command || "").slice(0, 80) },
  str_replace_based_edit_tool: { icon: PencilSquareIcon, name: "Editor", subtitle: (a) => a?.path || a?.file_path || "" },
  read: { icon: EyeIcon, name: "Read", subtitle: (a) => a?.filePath || a?.path || "" },
  write: { icon: DocumentPlusIcon, name: "Write", subtitle: (a) => a?.filePath || a?.path || "" },
  glob: { icon: MagnifyingGlassIcon, name: "Glob", subtitle: (a) => a?.pattern || "" },
  grep: { icon: MagnifyingGlassIcon, name: "Search", subtitle: (a) => a?.pattern || "" },
  web_search: { icon: GlobeAltIcon, name: "Web Search", subtitle: (a) => a?.query || "" },
  web_fetch: { icon: GlobeAltIcon, name: "Web Fetch", subtitle: (a) => a?.url || "" },
  code_execution: { icon: CpuChipIcon, name: "Code Exec", subtitle: (a) => (a?.code || "").slice(0, 60) },
  spawn_agent: { icon: CpuChipIcon, name: "Sub-Agent", subtitle: (a) => a?.description || a?.task || "" },
  todowrite: { icon: ClipboardDocumentListIcon, name: "Todos", subtitle: () => "" },
};

const def = computed(() =>
  toolDefs[tool.toolName] || { icon: CodeBracketIcon, name: tool.toolName, subtitle: () => "" },
);

const subtitle = computed(() => def.value.subtitle(tool.input) || "");

const isDone = computed(() => tool.state === "output-available");
const hasError = computed(() => tool.state === "output-error");
const isPending = computed(() =>
  tool.state === "input-streaming" || tool.state === "input-available" || tool.state === "approval-requested",
);

const output = computed(() => {
  if (!isDone.value) return "";
  const r = tool.output;
  if (!r) return "";
  const text = typeof r === "string" ? r : JSON.stringify(r, null, 2);
  return text.length > 3000 ? text.slice(0, 3000) + "\n... (truncated)" : text;
});
</script>

<template>
  <button
    type="button"
    class="group/tc flex w-full items-center gap-2 px-2 py-1 text-left outline-none transition-colors hover:bg-surface-1/50"
    :class="expanded ? 'bg-surface-1' : ''"
    @click="expanded = !expanded"
  >
    <component
      :is="def.icon"
      class="size-4 shrink-0"
      :class="{
        'text-tertiary': isDone && !hasError,
        'text-accent': isPending,
        'text-danger': hasError,
      }"
    />
    <span class="text-copy text-secondary shrink-0">{{ def.name }}</span>
    <span class="text-copy text-tertiary min-w-0 flex-1 truncate font-mono">{{ subtitle }}</span>
    <ArrowPathIcon
      v-if="isPending"
      class="text-accent size-4 shrink-0 animate-spin"
    />
    <CheckCircleIcon v-else-if="isDone && !hasError" class="text-success size-4 shrink-0" />
    <ExclamationCircleIcon v-else-if="hasError" class="text-danger size-4 shrink-0" />
    <ChevronRightIcon
      class="text-tertiary size-4 shrink-0 transition-transform"
      :class="expanded ? 'rotate-90' : ''"
    />
  </button>

  <div v-if="expanded" class="mb-1 ml-6 mr-2 mt-0.5">
    <div v-if="hasError && tool.errorText" class="text-copy text-danger bg-danger-subtle p-2">
      {{ tool.errorText }}
    </div>
    <pre
      v-else-if="output || (tool.toolName === 'bash' && tool.input?.command)"
      class="bg-terminal text-terminal-text max-h-48 overflow-auto p-2.5 font-mono text-copy leading-relaxed"
    ><template v-if="tool.toolName === 'bash' && tool.input?.command"><span class="text-terminal-dim">$</span> {{ tool.input.command }}
</template>{{ output }}</pre>
    <div v-else-if="isPending" class="text-copy text-tertiary p-2 italic">Running...</div>
    <div v-else class="text-copy text-tertiary p-2 italic">No output</div>
  </div>
</template>
