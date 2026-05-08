<script setup lang="ts">
import {
  PlusIcon,
  ChatBubbleLeftIcon,
  FolderIcon,
  ChatBubbleLeftEllipsisIcon,
} from "@heroicons/vue/16/solid";

const route = useRoute();
const projectId = computed(() => {
  if (route.params.id) return route.params.id as string;
  return null;
});

const store = useHiveStore();
const { activeSessionId, setActiveSession } = useActiveWorktree(projectId);

// Fetch sessions from OpenCode via our new endpoint
const { data: sessionList, refresh: refreshSessions } = useFetch(
  () => projectId.value ? `/api/projects/${projectId.value}/sessions` : null,
  {
    watch: [projectId],
    default: () => [],
  },
);

// Refresh session list when agent finishes working (title may have updated)
const isWorking = computed(() => {
  if (!projectId.value) return false;
  return store.connection(projectId.value).isWorking.value;
});

watch(isWorking, (working, wasWorking) => {
  if (wasWorking && !working) {
    // Agent just finished — refresh to pick up new title
    setTimeout(() => refreshSessions(), 500);
  }
});

// Poll for session list updates (new sessions from TUI or other sources)
let sessionPoll: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  sessionPoll = setInterval(() => refreshSessions(), 5000);
});
onUnmounted(() => {
  if (sessionPoll) clearInterval(sessionPoll);
});

// File tree
const { data: fileTree } = await useFetch(
  () => projectId.value ? `/api/projects/${projectId.value}/file-tree` : null,
  {
    watch: [projectId],
    default: () => [],
  },
);

type SidebarTab = "sessions" | "files";
const activeTab = ref<SidebarTab>("sessions");

function selectSession(sessionId: string) {
  setActiveSession(sessionId);
  const key = projectId.value;
  if (!key) return;
  store.switchSession(key, sessionId);
}

const creatingSession = ref(false);

async function createNewSession() {
  if (!projectId.value) return;

  creatingSession.value = true;
  try {
    const result = await $fetch(`/api/projects/${projectId.value}/sessions`, {
      method: "POST",
    }) as { sessionId: string };

    setActiveSession(result.sessionId);
    store.switchSession(projectId.value, result.sessionId);
    await refreshSessions();

    nextTick(() => {
      const input = document.querySelector("textarea[data-chat-input]") as HTMLTextAreaElement;
      input?.focus();
    });
  } catch (e: any) {
    console.error("Failed to create session:", e);
  } finally {
    creatingSession.value = false;
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <OHeader borderless>
      <template #leading>
        <div class="flex items-center gap-0.5">
          <OButton
            variant="transparent"
            size="xs"
            :icon-left="ChatBubbleLeftEllipsisIcon"
            :class="activeTab === 'sessions' ? 'text-primary' : 'text-tertiary'"
            @click="activeTab = 'sessions'"
          />
          <OButton
            variant="transparent"
            size="xs"
            :icon-left="FolderIcon"
            :class="activeTab === 'files' ? 'text-primary' : 'text-tertiary'"
            @click="activeTab = 'files'"
          />
        </div>
      </template>
      <template #trailing>
        <OButton
          v-if="activeTab === 'sessions'"
          variant="transparent"
          size="xs"
          :icon-left="PlusIcon"
          :loading="creatingSession"
          :disabled="!projectId"
          title="New chat"
          @click="createNewSession"
        />
      </template>
    </OHeader>

    <!-- Sessions tab -->
    <div v-if="activeTab === 'sessions'" class="flex-1 overflow-auto p-1.5">
      <div
        v-if="!projectId"
        class="text-copy-sm text-tertiary px-2 py-4 text-center"
      >
        Open a project first
      </div>

      <div v-else-if="!sessionList.length" class="text-copy-sm text-tertiary px-2 py-4 text-center">
        No sessions yet
      </div>

      <div v-else class="flex flex-col gap-0.5">
        <OHover
          v-for="session in sessionList"
          :key="session.id"
          full-width
          :active="activeSessionId === session.id"
          class="cursor-pointer"
          @click="selectSession(session.id)"
        >
          <div class="flex w-full items-center gap-2 px-2 py-1.5">
            <ChatBubbleLeftIcon class="text-tertiary size-3.5 shrink-0" />
            <span
              class="text-copy-sm min-w-0 flex-1 truncate"
              :class="activeSessionId === session.id ? 'text-primary' : 'text-secondary'"
            >
              {{ session.title }}
            </span>
          </div>
        </OHover>
      </div>
    </div>

    <!-- Files tab -->
    <div v-if="activeTab === 'files'" class="flex-1 overflow-auto py-1">
      <div
        v-if="!projectId"
        class="text-copy-sm text-tertiary px-2 py-4 text-center"
      >
        Open a project first
      </div>
      <div v-else-if="!fileTree?.length" class="text-copy-sm text-tertiary px-2 py-4 text-center">
        No files
      </div>
      <OSidebarFileTree v-else :nodes="fileTree" />
    </div>
  </div>
</template>
