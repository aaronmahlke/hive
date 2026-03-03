<script setup lang="ts">
const {
  files,
  viewedFiles,
  selectedFile,
  comments,
  unresolvedComments,
  loading,
  commitMessage,
  committing,
  commitError,
  ahead,
  behind,
  branch,
  pushing,
  pushError,
  selectFile,
  toggleViewed,
  requestChanges,
  commit,
  push,
  fetchChanges,
  init,
} = useChanges();

async function stageAll() {
  for (const f of files.value) {
    if (!viewedFiles.value.has(f.path)) {
      toggleViewed(f.path);
    }
  }
}

// Initialize on mount
onMounted(() => init());

// Re-initialize when route or active worktree changes
const route = useRoute();
const { activeWorktreePath } = useActiveWorktree(
  computed(() => (route.params.id as string) || null),
);
watch(() => route.params.id, () => init());
watch(activeWorktreePath, () => init());

// Auto-refresh: poll every 5s while a project is open
const projectId = computed(() => (route.params.id as string) || null);

const { pause, resume } = useIntervalFn(() => {
  if (projectId.value && !loading.value) {
    fetchChanges();
  }
}, 5000, { immediate: false });

watch(projectId, (id) => {
  if (id) resume();
  else pause();
}, { immediate: true });

onUnmounted(() => pause());

onKeyStroke("Escape", () => {
  const { commentInputActive } = useChanges();
  if (commentInputActive.value) return;
  if (selectedFile.value) {
    selectedFile.value = null;
  }
});
</script>

<template>
  <OChangesSidebar
    :files="files"
    :viewed-files="viewedFiles"
    :selected-file="selectedFile"
    :comment-count="unresolvedComments.length"
    :comments="comments"
    :loading="loading"
    :default-commit-message="commitMessage"
    :committing="committing"
    :commit-error="commitError"
    :ahead="ahead"
    :behind="behind"
    :branch="branch"
    :pushing="pushing"
    :push-error="pushError"
    @select-file="(path: string, mode?: 'combined' | 'staged' | 'unstaged') => selectFile(path, mode)"
    @toggle-viewed="toggleViewed"
    @stage-all="stageAll"
    @request-changes="requestChanges"
    @commit="commit($event)"
    @push="push"
    @refresh="fetchChanges"
  />
</template>
