<script setup lang="ts">
import {
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  CodeBracketIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  DocumentPlusIcon,
  PencilSquareIcon,
  GlobeAltIcon,
  ListBulletIcon,
  ClipboardDocumentListIcon,
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
  connectionKey: string;
};

const { part, connectionKey } = defineProps<Props>();
const expanded = ref(true); // Task calls are expanded by default

const store = useHiveStore();
const { relativePath } = useProjectPath();

const childSessionId = computed(() => part.state?.metadata?.sessionId as string | undefined);
const description = computed(() => part.state?.input?.description || "");
const agentType = computed(() => part.state?.input?.subagent_type || "task");

// Fetch child session messages when the session ID becomes available
watch(childSessionId, (sid) => {
  if (sid) {
    store.fetchSessionMessages(connectionKey, sid);
  }
}, { immediate: true });

// Get child session messages (reactive — updates via SSE)
const childMessages = computed(() => {
  if (!childSessionId.value) return [];
  return store.childMessages(connectionKey, childSessionId.value).value;
});

// Check if child session is working
const childWorking = computed(() => {
  if (!childSessionId.value) return false;
  return store.isSessionWorking(connectionKey, childSessionId.value);
});

// Extract tool calls from child session messages for the summary
const childToolCalls = computed(() => {
  const tools: { tool: string; title: string; status: string }[] = [];
  for (const msg of childMessages.value) {
    if (msg.info.role !== "assistant") continue;
    for (const p of msg.parts) {
      if (p.type === "tool" && p.tool) {
        const rawTitle = p.state?.title || toolSubtitle(p.tool, p.state?.input) || "";
        tools.push({
          tool: p.tool,
          title: relativePath(rawTitle),
          status: p.state?.status || "pending",
        });
      }
    }
  }
  return tools;
});

// Get pending permissions for this child session
const childPermissions = computed(() => {
  const s = store.connection(connectionKey).state.value;
  if (!s || !childSessionId.value) return [];
  return s.pendingPermissions.filter((p) => p.sessionID === childSessionId.value);
});

// Get pending questions for this child session
const childQuestions = computed(() => {
  const s = store.connection(connectionKey).state.value;
  if (!s || !childSessionId.value) return [];
  return s.pendingOcQuestions.filter((q) => q.sessionID === childSessionId.value);
});

const toolIcons: Record<string, any> = {
  read: EyeIcon,
  edit: PencilSquareIcon,
  write: DocumentPlusIcon,
  bash: CommandLineIcon,
  glob: MagnifyingGlassIcon,
  grep: MagnifyingGlassIcon,
  webfetch: GlobeAltIcon,
  websearch: GlobeAltIcon,
  codesearch: MagnifyingGlassIcon,
  list: ListBulletIcon,
  todowrite: ClipboardDocumentListIcon,
  task: CpuChipIcon,
};

function toolSubtitle(tool: string, input: any): string {
  if (!input) return "";
  switch (tool) {
    case "read": return input.filePath || input.path || "";
    case "edit": return input.filePath || input.path || "";
    case "write": return input.filePath || input.path || "";
    case "bash": return input.description || (input.command || "").slice(0, 60);
    case "glob": return input.pattern || "";
    case "grep": return input.pattern || "";
    case "webfetch": return input.url || "";
    case "task": return input.description || "";
    default: return "";
  }
}

const duration = computed(() => {
  const t = part.state?.time;
  if (!t?.start) return null;
  const end = t.end || Date.now();
  const ms = end - t.start;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
});

const router = useRouter();
const route = useRoute();

function toggle() {
  expanded.value = !expanded.value;
}

function navigateToChild() {
  if (childSessionId.value) {
    router.push({
      path: route.path,
      query: { session: childSessionId.value },
    });
  }
}
</script>

<template>
  <div
    class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1 text-left transition-colors hover:bg-subtle"
    :class="expanded ? 'bg-subtle' : ''"
    @click="childSessionId ? navigateToChild() : toggle()"
  >
    <CpuChipIcon
      class="size-3.5 shrink-0"
      :class="{
        'text-tertiary': part.state?.status === 'completed',
        'text-accent': part.state?.status === 'running' || part.state?.status === 'pending',
        'text-danger': part.state?.status === 'error',
      }"
    />
    <span class="text-copy text-secondary shrink-0 capitalize">{{ agentType }} Agent</span>
    <span class="text-copy text-tertiary min-w-0 flex-1 truncate">{{ description }}</span>
    <span v-if="duration" class="text-copy text-tertiary shrink-0 font-mono">{{ duration }}</span>
    <OLoader
      v-if="part.state?.status === 'running' || part.state?.status === 'pending'"
      size="xs"
      class="text-primary shrink-0"
    />
    <CheckCircleIcon v-else-if="part.state?.status === 'completed'" class="text-success size-3 shrink-0" />
    <ExclamationCircleIcon v-else-if="part.state?.status === 'error'" class="text-danger size-3 shrink-0" />
  </div>

  <!-- Expanded: child session activity -->
  <div v-if="expanded && childSessionId" class="mb-1 mt-0.5">
    <!-- Child permission (one at a time) -->
    <OChatPermission
      v-if="childPermissions.length"
      :key="childPermissions[0].id"
      :permission="childPermissions[0]"
      @reply="(id, reply, sid) => store.replyPermission(connectionKey, id, reply, sid)"
    />

    <!-- Child question (one at a time) -->
    <OChatOcQuestion
      v-if="childQuestions.length"
      :key="childQuestions[0].id"
      :request="childQuestions[0]"
      @reply="(id, answers) => store.replyQuestion(connectionKey, id, answers)"
      @reject="(id) => store.rejectQuestion(connectionKey, id)"
    />

    <!-- Child tool call summary -->
    <div v-if="childToolCalls.length" class="flex flex-col gap-0.5 px-3 py-1">
      <div
        v-for="(tc, i) in childToolCalls"
        :key="i"
        class="flex items-center gap-2 py-0.5"
      >
        <component
          :is="toolIcons[tc.tool] || CodeBracketIcon"
          class="size-3 shrink-0"
          :class="{
            'text-tertiary': tc.status === 'completed',
            'text-primary': tc.status === 'running' || tc.status === 'pending',
            'text-danger': tc.status === 'error',
          }"
        />
        <span class="text-copy text-tertiary truncate">{{ tc.title }}</span>
        <OLoader
          v-if="tc.status === 'running' || tc.status === 'pending'"
          size="xs"
          class="text-primary shrink-0"
        />
      </div>
    </div>

    <!-- Working indicator if no tool calls yet -->
    <div v-else-if="childWorking" class="flex items-center gap-2 px-3 py-1">
      <OLoader size="xs" class="text-primary" />
      <span class="text-copy text-tertiary">Working...</span>
    </div>
  </div>
</template>
