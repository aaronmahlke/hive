<script setup lang="ts">
import { CommandLineIcon, PlusIcon } from "@heroicons/vue/16/solid";

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: projectData } = useFetch(`/api/projects/${projectId.value}`);

const store = useHiveStore();
const { activeWorktreePath, activeSessionId, setActiveSession } = useActiveWorktree(projectId);
const chatKey = computed(() => `${connectionKey.value}:${activeSessionId.value || "default"}`);

// Fetch worktrees to resolve the active worktree's metadata
const { data: worktreeList, refresh: refreshWorktrees } = await useFetch("/api/worktrees", {
  query: { projectId },
  watch: [projectId],
  default: () => [],
});

// Compute the active worktree object (null = main)
const activeWorktree = computed(() => {
  if (!activeWorktreePath.value) return null;
  return worktreeList.value.find((wt: any) => wt.path === activeWorktreePath.value) || null;
});

// Connection key for the store: projectId for main, wt:<path> for worktrees
const connectionKey = computed(() => {
  if (!activeWorktreePath.value) return projectId.value;
  return `wt:${activeWorktreePath.value}`;
});

// Activate main project on mount
onMounted(() => {
  store.activate(projectId.value);
});

// Watch for worktree switches — activate connections as needed.
// We watch activeWorktreePath directly (not activeWorktree) because the
// worktreeList might be stale when a worktree is first selected.
watch(activeWorktreePath, async (path) => {
  if (!path) return;

  // Refresh worktree list to pick up newly created worktrees
  await refreshWorktrees();

  const wt = worktreeList.value.find((w: any) => w.path === path);
  if (wt) {
    store.activateWorktree({
      projectId: projectId.value,
      worktreePath: wt.path,
      branchName: wt.branchName,
    });
  } else {
    const branchGuess = path.split("/").pop() || "unknown";
    store.activateWorktree({
      projectId: projectId.value,
      worktreePath: path,
      branchName: branchGuess,
    });
  }
}, { immediate: true });

const creatingSession = ref(false);

async function createNewSession() {
  const wt = activeWorktree.value;
  const worktreeId = wt?.id || store.connection(connectionKey.value).state.value?.worktreeId;

  if (!worktreeId) return;

  creatingSession.value = true;
  try {
    const result = await $fetch("/api/sessions?new=true", {
      method: "POST",
      body: { worktreeId },
    }) as { sessionId: string; opencodeSessionId: string };

    setActiveSession(result.opencodeSessionId);
    store.switchSession(connectionKey.value, result.opencodeSessionId);

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

// Header title
const headerTitle = computed(() => {
  if (activeWorktree.value) {
    return activeWorktree.value.branchName;
  }
  if (activeWorktreePath.value) {
    return activeWorktreePath.value.split("/").pop() || "Worktree";
  }
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
      :icon="CommandLineIcon"
      :title="headerTitle"
    >
      <template #trailing>
        <OButton
          variant="transparent"
          size="xs"
          :icon-left="PlusIcon"
          :loading="creatingSession"
          title="New session"
          @click="createNewSession"
        />
        <OScriptRunner
          :project-id="projectId"
          :worktree-path="activeWorktreePath"
        />
      </template>
    </OHeader>

    <OChat
      :key="chatKey"
      :project-id="connectionKey"
      :placeholder="activeWorktree ? `Chat with ${activeWorktree.branchName} agent...` : 'Chat with the main agent...'"
    />

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
