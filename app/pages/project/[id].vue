<script setup lang="ts">
import { CommandLineIcon, PlusIcon, ArrowLeftIcon } from "@heroicons/vue/16/solid";

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: projectData } = useFetch(`/api/projects/${projectId.value}`);

const store = useHiveStore();
const { activeSessionId, setActiveSession } = useActiveWorktree(projectId);
const { isInChildSession, sessionId: currentSessionId } = store.connection(projectId.value);
const chatKey = computed(() => `${projectId.value}:${currentSessionId.value || "default"}`);

// Activate main project on mount, passing the user's preferred session
onMounted(() => {
  store.activate(projectId.value, activeSessionId.value);
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
  store.exitChildSession(projectId.value);
}

// Header title
const headerTitle = computed(() => {
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
          size="xs"
          :icon-left="ArrowLeftIcon"
          @click="goBack"
        />
      </template>
      <template #trailing>
        <OButton
          v-if="!isInChildSession"
          variant="transparent"
          size="xs"
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

    <OChat
      :key="chatKey"
      :project-id="projectId"
      :placeholder="isInChildSession ? 'Viewing sub-agent session...' : 'Chat with the main agent...'"
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
