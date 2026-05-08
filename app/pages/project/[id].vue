<script setup lang="ts">
import { CommandLineIcon, PlusIcon, ArrowLeftIcon } from "@heroicons/vue/16/solid";

const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.id as string);
const childSessionId = computed(() => (route.query.session as string) || null);
const isInChildSession = computed(() => !!childSessionId.value);

const { rightCollapsed, toggleRight } = useSidebarState();

const { data: projectData } = useFetch(`/api/projects/${projectId.value}`);

const store = useHiveStore();
const { activeSessionId, setActiveSession } = useActiveWorktree(projectId);

// The session to display: child session from URL query, or the active session
const displaySessionId = computed(() => childSessionId.value || activeSessionId.value);
const chatKey = computed(() => `${projectId.value}:${displaySessionId.value || "default"}`);

// Activate main project on mount, passing the user's preferred session
onMounted(() => {
  store.activate(projectId.value, activeSessionId.value);
});

// When navigating to a child session via URL, switch the store to it
watch(childSessionId, (sid) => {
  if (sid) {
    store.enterChildSession(projectId.value, sid);
  } else {
    // Navigated back — restore the active session
    const stored = activeSessionId.value;
    const current = store.connection(projectId.value).sessionId.value;
    if (stored && current !== stored) {
      store.exitChildSession(projectId.value);
    }
  }
});

const creatingSession = ref(false);

async function createNewSession() {
  creatingSession.value = true;
  try {
    const result = await $fetch(`/api/projects/${projectId.value}/sessions`, {
      method: "POST",
    }) as { sessionId: string };

    setActiveSession(result.sessionId);
    store.switchSession(projectId.value, result.sessionId);

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

function goBack() {
  router.back();
}

// Header title
const headerTitle = computed(() => {
  if (isInChildSession.value) return "Sub-agent";
  return projectData.value?.name ?? "Project";
});

// Changes overlay state
const {
  selectedFile,
  selectedDiffMode,
  selectedFileDiff,
  selectedFileContent,
  loadingFileContent,
  selectedFileComments,
  viewedFiles,
  closeOverlay,
  addComment,
  deleteComment,
  updateComment,
  markViewedAndNext,
} = useChanges();

const isSelectedFileViewed = computed(() =>
  selectedFile.value ? viewedFiles.value.has(selectedFile.value) : false,
);
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <OHeader
      :icon="isInChildSession ? undefined : CommandLineIcon"
      :title="headerTitle"
    >
      <template v-if="isInChildSession" #leading>
        <OButton
          variant="ghost"
          size="sm"
          :icon-left="ArrowLeftIcon"
          @click="goBack"
        />
      </template>
      <template #trailing>
        <OButton
          variant="ghost"
          size="sm"
          @click="toggleRight"
        >
          <template #leading>
            <OSidebarIcon :collapsed="rightCollapsed" side="right" />
          </template>
        </OButton>
        <OButton
          v-if="!isInChildSession"
          variant="transparent"
          size="sm"
          :icon-left="PlusIcon"
          :loading="creatingSession"
          title="New session"
          @click="createNewSession"
        />
        <OScriptRunner
          v-if="!isInChildSession"
          :project-id="projectId"
        />
      </template>
    </OHeader>

    <div class="flex min-h-0 flex-1">
      <div class="flex min-w-0 flex-1 flex-col">
        <OChat
          :key="chatKey"
          :project-id="projectId"
          :placeholder="isInChildSession ? 'Viewing sub-agent session...' : 'Ask anything...'"
        />
      </div>

      <aside
        class="shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
        :class="rightCollapsed ? 'w-0' : 'w-52'"
      >
        <div class="w-52 h-full border-l border-neutral">
          <OChangesPanel />
        </div>
      </aside>
    </div>

    <!-- Diff overlay -->
    <OChangesOverlay
      v-if="selectedFile"
      :file-path="selectedFile"
      :file-diff="selectedFileDiff"
      :file-content="selectedFileContent"
      :loading-content="loadingFileContent"
      :comments="selectedFileComments"
      :viewed="isSelectedFileViewed"
      :diff-mode="selectedDiffMode"
      @close="closeOverlay"
      @toggle-viewed="markViewedAndNext(selectedFile!)"
      @add-comment="addComment($event)"
      @delete-comment="deleteComment($event)"
      @update-comment="(id: string, content: string) => updateComment(id, content)"
    />
  </div>
</template>
