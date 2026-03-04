<script setup lang="ts">
import {
  PlusIcon,
  FolderIcon,
  UserGroupIcon,
} from "@heroicons/vue/16/solid";

type SidebarTab = "agents" | "files";

const route = useRoute();
const projectId = computed(() => {
  if (route.params.id) return route.params.id as string;
  return null;
});

const activeTab = ref<SidebarTab>("agents");

const { activeWorktreePath, activeSessionId, setActive, setActiveSession, isActive } = useActiveWorktree(projectId);

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


// Sessions for the active worktree
const activeWorktreeId = computed(() => {
  if (!activeWorktreePath.value) return null;
  const wt = worktreeList.value.find((w: any) => w.path === activeWorktreePath.value);
  return wt?.id || null;
});

const mainWorktreeId = computed(() => mainWorktree.value?.id || null);

const sessionWorktreeId = computed(() => activeWorktreeId.value || mainWorktreeId.value);

const { data: sessionList, refresh: refreshSessions } = useFetch(
  "/api/sessions",
  {
    query: { worktreeId: sessionWorktreeId },
    watch: [sessionWorktreeId],
    default: () => [],
  },
);

watch(activeSessionId, () => refreshSessions());

// Also fetch sessions for main when viewing a worktree (to show main's sessions when main is expanded)
const { data: mainSessionList } = useFetch(
  "/api/sessions",
  {
    query: { worktreeId: mainWorktreeId },
    watch: [mainWorktreeId],
    default: () => [],
  },
);

function sessionsForWorktree(wt: any): any[] {
  if (!wt) return [];
  if (wt.isMain) return mainSessionList.value as any[];
  if (wt.id === sessionWorktreeId.value) return sessionList.value as any[];
  return [];
}

function selectSession(ocSessionId: string) {
  setActiveSession(ocSessionId);
  const key = activeWorktreePath.value ? `wt:${activeWorktreePath.value}` : projectId.value;
  if (!key) return;
  store.switchSession(key, ocSessionId);
}

async function deleteSession(ocSessionId: string, e: Event) {
  e.stopPropagation();
  // If this is the active session, switch to another one first
  if (activeSessionId.value === ocSessionId) {
    const sessions = sessionsForWorktree(
      activeWorktreePath.value ? activeWorktreeObj.value : mainWorktree.value,
    );
    const other = sessions.find((s: any) => s.opencodeSessionId !== ocSessionId);
    if (other) {
      selectSession(other.opencodeSessionId);
    }
  }
  // TODO: Add confirmation dialog
  // For now just refresh the list (OpenCode sessions can't be deleted via API easily)
  await refreshSessions();
}

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
        <template v-if="mainWorktree">
          <OSidebarWorktreeItem
            is-main
            :branch-name="mainWorktree.branchName"
            :agent-status="mainWorktree.agentStatus"
            :pending-signals="mainWorktree.pendingSignals"
            :active="isActive(null)"
            @click="selectWorktree(mainWorktree)"
          />
          <template v-if="isActive(null) && sessionsForWorktree(mainWorktree).length > 1">
            <OSidebarSessionItem
              v-for="session in sessionsForWorktree(mainWorktree)"
              :key="session.opencodeSessionId"
              :title="session.title"
              :active="activeSessionId === session.opencodeSessionId || (!activeSessionId && sessionsForWorktree(mainWorktree).indexOf(session) === 0)"
              @click="selectSession(session.opencodeSessionId)"
              @delete="deleteSession(session.opencodeSessionId, $event)"
            />
          </template>
        </template>

        <template v-if="linkedWorktrees.length">
          <div class="text-copy-xs text-tertiary mt-2 mb-0.5 px-2 font-medium uppercase tracking-wide">
            Worktrees
          </div>
          <template v-for="wt in linkedWorktrees" :key="wt.path">
            <OSidebarWorktreeItem
              :branch-name="wt.branchName"
              :agent-status="wt.agentStatus"
              :pending-signals="wt.pendingSignals"
              :active="isActive(wt.path)"
              removable
              @click="selectWorktree(wt)"
              @remove="deleteWorktree(wt, $event)"
            />
            <template v-if="isActive(wt.path) && sessionsForWorktree(wt).length > 1">
              <OSidebarSessionItem
                v-for="session in sessionsForWorktree(wt)"
                :key="session.opencodeSessionId"
                :title="session.title"
                :active="activeSessionId === session.opencodeSessionId || (!activeSessionId && sessionsForWorktree(wt).indexOf(session) === 0)"
                @click="selectSession(session.opencodeSessionId)"
                @delete="deleteSession(session.opencodeSessionId, $event)"
              />
            </template>
          </template>
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
