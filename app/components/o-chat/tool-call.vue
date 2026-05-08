<script setup lang="ts">
import {
  EyeIcon,
  CodeBracketIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  DocumentPlusIcon,
  PencilSquareIcon,
  GlobeAltIcon,
  ListBulletIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/vue/16/solid";

type ToolPart = {
  type: string;
  tool: string;
  callID?: string;
  state: {
    status: "pending" | "running" | "completed" | "error";
    input?: any;
    output?: string;
    title?: string;
    metadata?: any;
    error?: string;
    time?: { start?: number; end?: number };
  };
};

type Props = {
  part: ToolPart;
};

const { part } = defineProps<Props>();
const isRead = computed(() => part.tool === "read" || part.tool === "glob" || part.tool === "list");
const expanded = ref(false);

function toggle() {
  if (isRead.value) return;
  expanded.value = !expanded.value;
}

type ToolDef = {
  icon: any;
  name: string;
  subtitle: (input: any) => string;
};

const toolDefs: Record<string, ToolDef> = {
  read: { icon: EyeIcon, name: "Read", subtitle: (i) => i?.filePath || i?.path || "" },
  edit: { icon: PencilSquareIcon, name: "Edit", subtitle: (i) => i?.filePath || i?.path || "" },
  write: { icon: DocumentPlusIcon, name: "Write", subtitle: (i) => i?.filePath || i?.path || "" },
  bash: { icon: CommandLineIcon, name: "Shell", subtitle: (i) => i?.description || (i?.command || "").slice(0, 80) },
  glob: { icon: MagnifyingGlassIcon, name: "Glob", subtitle: (i) => i?.pattern || "" },
  grep: { icon: MagnifyingGlassIcon, name: "Search", subtitle: (i) => i?.pattern || "" },
  webfetch: { icon: GlobeAltIcon, name: "Fetch", subtitle: (i) => i?.url || "" },
  websearch: { icon: GlobeAltIcon, name: "Web", subtitle: (i) => i?.query || "" },
  codesearch: { icon: MagnifyingGlassIcon, name: "Code Search", subtitle: (i) => i?.query || "" },
  list: { icon: ListBulletIcon, name: "List", subtitle: (i) => i?.path || "" },
  todowrite: { icon: ClipboardDocumentListIcon, name: "Todos", subtitle: () => "" },
  task: { icon: CpuChipIcon, name: "Agent", subtitle: (i) => i?.description || "" },
};

const def = computed(() => toolDefs[part.tool] || { icon: CodeBracketIcon, name: part.tool, subtitle: () => "" });
const subtitle = computed(() => def.value.subtitle(part.state?.input) || part.state?.title || "");

const duration = computed(() => {
  const t = part.state?.time;
  if (!t?.start || !t?.end) return null;
  const ms = t.end - t.start;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
});

const output = computed(() => {
  const o = part.state?.output;
  if (!o) return "";
  return o.length > 3000 ? o.slice(0, 3000) + "\n... (truncated)" : o;
});

const isEdit = computed(() => part.tool === "edit" || part.tool === "write");
const editInput = computed(() => part.state?.input || {});
</script>

<template>
  <div
    class="group/tc flex w-full items-center gap-2 rounded-lg px-3 py-1 text-left transition-colors hover:bg-surface-1"
    :class="[
      isRead ? '' : 'cursor-pointer',
      expanded ? 'bg-surface-1' : '',
    ]"
    @click="toggle"
  >
    <component
      :is="def.icon"
      class="size-3.5 shrink-0"
      :class="{
        'text-tertiary': part.state?.status === 'completed',
        'text-accent': part.state?.status === 'running' || part.state?.status === 'pending',
        'text-danger': part.state?.status === 'error',
      }"
    />
    <span class="text-copy text-secondary shrink-0">{{ def.name }}</span>
    <span class="text-copy text-tertiary min-w-0 flex-1 truncate font-mono">{{ subtitle }}</span>
    <span v-if="duration" class="text-copy text-tertiary shrink-0 font-mono">{{ duration }}</span>
    <OLoader
      v-if="part.state?.status === 'running' || part.state?.status === 'pending'"
      size="xs"
      class="text-primary shrink-0"
    />
    <CheckCircleIcon v-else-if="part.state?.status === 'completed'" class="text-success size-3 shrink-0" />
    <ExclamationCircleIcon v-else-if="part.state?.status === 'error'" class="text-danger size-3 shrink-0" />

  </div>

  <div v-if="expanded" class="mb-1 mt-0.5">
    <div v-if="part.state?.status === 'error' && part.state?.error" class="text-copy text-danger rounded bg-danger-subtle p-2">
      {{ part.state.error }}
    </div>

    <div
      v-else-if="isEdit && (editInput.oldString || editInput.newString || editInput.content)"
      class="max-h-64 overflow-auto rounded-md font-mono text-copy leading-relaxed"
    >
      <template v-if="part.tool === 'edit' && editInput.oldString">
        <div
          v-for="(line, i) in editInput.oldString.split('\n')"
          :key="'old-' + i"
          class="px-3 py-0"
          style="background: var(--diff-deletion-bg, rgba(255, 46, 63, 0.08)); color: var(--diff-deletion-text, #ff6b78)"
        >- {{ line }}</div>
        <div
          v-for="(line, i) in editInput.newString.split('\n')"
          :key="'new-' + i"
          class="px-3 py-0"
          style="background: var(--diff-addition-bg, rgba(46, 160, 67, 0.08)); color: var(--diff-addition-text, #56d364)"
        >+ {{ line }}</div>
      </template>
      <template v-else-if="part.tool === 'write' && editInput.content">
        <pre class="bg-terminal text-terminal-text overflow-auto rounded-md p-3">{{ editInput.content.length > 2000 ? editInput.content.slice(0, 2000) + '\n... (truncated)' : editInput.content }}</pre>
      </template>
    </div>

    <pre
      v-else-if="output || (part.tool === 'bash' && part.state?.input?.command)"
      class="bg-terminal text-terminal-text max-h-48 overflow-auto rounded-md p-3 font-mono text-copy leading-relaxed"
    ><template v-if="part.tool === 'bash' && part.state?.input?.command"><span class="text-terminal-dim">$</span> {{ part.state.input.command }}
</template>{{ output }}</pre>
    <div v-else class="text-copy text-tertiary px-3 py-2 italic">No output</div>
  </div>
</template>
