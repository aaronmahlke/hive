<script setup lang="ts">
import { CommandLineIcon } from "@heroicons/vue/16/solid";

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: projectData } = useFetch(`/api/projects/${projectId.value}`);

const store = useHiveStore();
const { activeWorktreePath } = useActiveWorktree(projectId);

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
    // Worktree not in list yet (edge case) — extract branch from path
    const branchGuess = path.split("/").pop() || "unknown";
    store.activateWorktree({
      projectId: projectId.value,
      worktreePath: path,
      branchName: branchGuess,
    });
  }
}, { immediate: true });

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
        <OScriptRunner
          :project-id="projectId"
          :worktree-path="activeWorktreePath"
        />
      </template>
    </OHeader>

    <OChat
      :key="connectionKey"
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
