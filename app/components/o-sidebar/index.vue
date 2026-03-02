<script setup lang="ts">
import {
  CodeBracketIcon,
  PlusIcon,
  HomeIcon,
  FolderIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/vue/16/solid";

type SidebarTab = "agents" | "files";

const route = useRoute();
const projectId = computed(() => {
  if (route.params.id) return route.params.id as string;
  return null;
});

const activeTab = ref<SidebarTab>("agents");

const { activeWorktreePath, setActive, isActive } = useActiveWorktree(projectId);

const { data: worktreeList, refresh: refreshWorktrees } = await useFetch(
  "/api/worktrees",
  {
    query: { projectId },
    watch: [projectId],
    default: () => [],
  },
);

let worktreePoll: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  worktreePoll = setInterval(() => refreshWorktrees(), 3000);
});
onUnmounted(() => {
  if (worktreePoll) clearInterval(worktreePoll);
});

const mainWorktree = computed(() =>
  worktreeList.value.find((wt: any) => wt.isMain),
);

const linkedWorktrees = computed(() =>
  worktreeList.value.filter((wt: any) => !wt.isMain),
);

// Create worktree
const showNewBranch = ref(false);
const newBranchName = ref("");
const creating = ref(false);

async function createNewWorktree() {
  if (!newBranchName.value || !projectId.value) return;

  creating.value = true;
  try {
    await $fetch("/api/worktrees", {
      method: "POST",
      body: {
        projectId: projectId.value,
        branchName: newBranchName.value,
      },
    });
    newBranchName.value = "";
    showNewBranch.value = false;
    await refreshWorktrees();
  } catch (e: any) {
    console.error("Failed to create worktree:", e);
  } finally {
    creating.value = false;
  }
}

function selectWorktree(wt: any) {
  // null path = main worktree
  setActive(wt.isMain ? null : wt.path);
}

const store = useHiveStore();

async function deleteWorktree(wt: any, e: Event) {
  e.stopPropagation();
  if (!wt.id) return;

  // If this worktree is active, switch back to main
  if (isActive(wt.path)) {
    setActive(null);
  }

  // Deactivate the connection
  store.deactivate(`wt:${wt.path}`);

  try {
    await $fetch(`/api/worktrees/${wt.id}`, { method: "DELETE" });
    await refreshWorktrees();
  } catch (e: any) {
    console.error("Failed to delete worktree:", e);
  }
}

const statusClasses: Record<string, string> = {
  idle: "bg-inverse/30",
  working: "bg-accent",
  question: "bg-warn",
  done: "bg-success",
  error: "bg-danger",
};

// File tree for the active worktree
const activeWorktreeObj = computed(() => {
  if (!activeWorktreePath.value) return null;
  return worktreeList.value.find((wt: any) => wt.path === activeWorktreePath.value) || null;
});

const fileTreePath = computed(() => activeWorktreeObj.value?.path || null);

const { data: fileTree, refresh: refreshFileTree } = await useFetch(
  () => projectId.value ? `/api/projects/${projectId.value}/file-tree` : null,
  {
    query: { worktreePath: fileTreePath },
    watch: [projectId, fileTreePath],
    default: () => [],
  },
);
</script>

<template>
  <div class="flex h-full flex-col">
    <OHeader borderless>
      <template #leading>
        <div class="flex items-center gap-0.5">
          <OButton
            variant="transparent"
            size="xs"
            :icon-left="UserGroupIcon"
            :class="activeTab === 'agents' ? 'text-primary' : 'text-tertiary'"
            @click="activeTab = 'agents'"
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
          v-if="activeTab === 'agents'"
          variant="transparent"
          size="xs"
          :icon-left="PlusIcon"
          :disabled="!projectId"
          @click="showNewBranch = !showNewBranch"
        />
      </template>
    </OHeader>

    <!-- Agents tab -->
    <div v-if="activeTab === 'agents'" class="flex-1 overflow-auto p-1.5">
      <div v-if="showNewBranch" class="mb-1.5 px-1">
        <form @submit.prevent="createNewWorktree" class="flex gap-1">
          <OInput
            v-model="newBranchName"
            placeholder="feature/my-branch"
            name="branch"
            :disabled="creating"
            class="flex-1"
          />
          <OButton
            type="submit"
            variant="primary"
            size="md"
            :loading="creating"
            :disabled="!newBranchName"
          >
            Go
          </OButton>
        </form>
      </div>

      <div
        v-if="!projectId"
        class="text-copy-sm text-tertiary px-2 py-4 text-center"
      >
        Open a project first
      </div>

      <div v-else class="flex flex-col gap-0.5">
        <!-- Main worktree -->
        <OHover
          v-if="mainWorktree"
          full-width
          :active="isActive(null)"
          class="cursor-pointer"
          @click="selectWorktree(mainWorktree)"
        >
          <div class="flex w-full items-center justify-between px-2 py-1.5">
            <div class="flex min-w-0 items-center gap-2">
              <HomeIcon class="text-tertiary size-3.5 shrink-0" />
              <span class="text-copy-sm text-primary truncate">
                {{ mainWorktree.branchName }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <span
                v-if="mainWorktree.pendingSignals > 0"
                class="bg-warn text-warn-on text-copy-xs grid size-4 place-items-center rounded-full font-medium"
              >
                {{ mainWorktree.pendingSignals }}
              </span>
              <span
                class="inline-block size-2 rounded-full"
                :class="[
                  statusClasses[mainWorktree.agentStatus] || statusClasses.idle,
                  mainWorktree.agentStatus === 'working' ? 'animate-pulse' : '',
                ]"
              />
            </div>
          </div>
        </OHover>

        <!-- Linked worktrees -->
        <template v-if="linkedWorktrees.length">
          <div class="text-copy-xs text-tertiary mt-2 mb-0.5 px-2 font-medium uppercase tracking-wide">
            Worktrees
          </div>
          <OHover
            v-for="wt in linkedWorktrees"
            :key="wt.path"
            full-width
            :active="isActive(wt.path)"
            class="cursor-pointer"
            @click="selectWorktree(wt)"
          >
            <div class="flex w-full items-center justify-between px-2 py-1.5 pl-4">
              <div class="flex min-w-0 items-center gap-2">
                <CodeBracketIcon class="text-tertiary size-3.5 shrink-0" />
                <span class="text-copy-sm text-primary truncate">
                  {{ wt.branchName }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <span
                  v-if="wt.pendingSignals > 0"
                  class="bg-warn text-warn-on text-copy-xs grid size-4 place-items-center rounded-full font-medium"
                >
                  {{ wt.pendingSignals }}
                </span>
                <button
                  type="button"
                  class="grid size-4 place-items-center rounded"
                  title="Remove worktree"
                  @click="deleteWorktree(wt, $event)"
                >
                  <XMarkIcon class="text-tertiary hover:text-danger hidden size-3 group-hover/h:block" />
                  <span
                    class="inline-block size-2 rounded-full group-hover/h:hidden"
                    :class="[
                      statusClasses[wt.agentStatus] || statusClasses.idle,
                      wt.agentStatus === 'working' ? 'animate-pulse' : '',
                    ]"
                  />
                </button>
              </div>
            </div>
          </OHover>
        </template>

        <div
          v-if="!mainWorktree && !linkedWorktrees.length"
          class="text-copy-sm text-tertiary px-2 py-4 text-center"
        >
          No worktrees
        </div>
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
