<script setup lang="ts">
const {
  files,
  viewedFiles,
  selectedFile,
  unresolvedComments,
  loading,
  selectFile,
  toggleViewed,
  requestChanges,
  fetchChanges,
  init,
} = useChanges();

// Initialize on mount
onMounted(() => init());

// Re-initialize when route changes
const route = useRoute();
watch(() => route.params.id, () => init());

// Auto-refresh when agent goes idle
const projectId = computed(() => (route.params.id as string) || null);
const store = useHiveStore();

// Track agent working state reactively
const agentWorking = computed(() => {
  if (!projectId.value) return false;
  const { isWorking } = store.project(projectId.value);
  return isWorking.value;
});

watch(agentWorking, (working, wasWorking) => {
  if (wasWorking && !working) {
    console.log("[changes] Agent finished, refreshing changes...");
    fetchChanges();
  }
});

// Escape key closes overlay
onKeyStroke("Escape", () => {
  if (selectedFile.value) {
    selectedFile.value = null;
  }
});

async function handleApprove() {
  // TODO: implement commit flow
  console.log("[changes] Approve & commit — not yet implemented");
}
</script>

<template>
  <OChangesSidebar
    :files="files"
    :viewed-files="viewedFiles"
    :selected-file="selectedFile"
    :comment-count="unresolvedComments.length"
    :loading="loading"
    @select-file="selectFile"
    @toggle-viewed="toggleViewed"
    @request-changes="requestChanges"
    @approve="handleApprove"
    @refresh="fetchChanges"
  />
</template>
