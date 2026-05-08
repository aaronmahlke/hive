<script setup lang="ts">
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ChatBubbleLeftIcon,
  CheckIcon,
  PlusIcon,
  DocumentIcon,
} from "@heroicons/vue/16/solid";

type ChangedFile = {
  path: string;
  status: string;
  staged?: boolean;
  modifiedAfterStaged?: boolean;
};

type ChangeComment = {
  id: string;
  filePath: string;
  resolved: boolean;
};

type Props = {
  files: ChangedFile[];
  viewedFiles: Set<string>;
  selectedFile: string | null;
  commentCount: number;
  comments: ChangeComment[];
  loading: boolean;
  defaultCommitMessage: string;
  committing: boolean;
  commitError: string | null;
  ahead: number;
  behind: number;
  branch: string | null;
  remoteExists: boolean;
  pushing: boolean;
  pushError: string | null;
};

type Emits = {
  "select-file": [path: string, mode?: "combined" | "staged" | "unstaged"];
  "toggle-viewed": [path: string];
  "stage-all": [];
  "request-changes": [];
  "commit": [message: string];
  push: [];
  refresh: [];
};

const {
  files,
  viewedFiles,
  selectedFile = null,
  commentCount = 0,
  comments = [],
  loading = false,
  defaultCommitMessage = "",
  committing = false,
  commitError = null,
  ahead = 0,
  behind = 0,
  branch = null,
  remoteExists = false,
  pushing = false,
  pushError = null,
} = defineProps<Props>();

const emit = defineEmits<Emits>();

// Count unresolved comments per file
const commentsByFile = computed(() => {
  const map = new Map<string, number>();
  for (const c of comments) {
    if (!c.resolved) {
      map.set(c.filePath, (map.get(c.filePath) || 0) + 1);
    }
  }
  return map;
});

const commitMessageInput = ref("");

function handleCommit() {
  if (!commitMessageInput.value.trim()) return;
  emit("commit", commitMessageInput.value.trim());
}

watch(() => files.length, (len, prevLen) => {
  if (prevLen > 0 && len === 0) {
    commitMessageInput.value = "";
  }
});

const unstagedFiles = computed(() =>
  files.filter((f) => !viewedFiles.has(f.path) || f.modifiedAfterStaged),
);

const stagedFiles = computed(() =>
  files.filter((f) => viewedFiles.has(f.path)),
);

const allViewed = computed(
  () => files.length > 0 && stagedFiles.value.length === files.length,
);

const statusLabels: Record<string, string> = {
  M: "Modified",
  A: "Added",
  D: "Deleted",
  R: "Renamed",
  "?": "Untracked",
};

const statusColors: Record<string, string> = {
  M: "text-accent",
  A: "text-success",
  D: "text-danger",
  R: "text-warn",
  "?": "text-tertiary",
};
</script>

<template>
  <div class="flex h-full flex-col">
    <OHeader title="Changes" borderless>
      <template #trailing>
        <span
          v-if="files.length"
          class="text-copy text-tertiary"
        >
          {{ stagedFiles.length }}/{{ files.length }}
        </span>
        <button
          type="button"
          class="text-tertiary hover:text-primary grid size-6 place-items-center rounded outline-none"
          title="Refresh"
          @click="emit('refresh')"
        >
          <ArrowPathIcon class="size-3.5" :class="loading ? 'animate-spin' : ''" />
        </button>
      </template>
    </OHeader>

    <div class="flex-1 overflow-auto p-1.5">
      <div
        v-if="!files.length && !loading"
        class="text-copy text-tertiary px-2 py-4 text-center"
      >
        No changes
      </div>

      <div
        v-if="loading && !files.length"
        class="text-copy text-tertiary flex items-center justify-center gap-2 px-2 py-4"
      >
        <ArrowPathIcon class="size-3.5 animate-spin" />
        Loading...
      </div>

      <template v-if="files.length">
        <!-- Unstaged files -->
        <div v-if="unstagedFiles.length">
          <div class="mb-1 flex items-center justify-between px-2">
            <p class="text-label uppercase tracking-wide text-tertiary">
              Unstaged ({{ unstagedFiles.length }})
            </p>
            <button
              type="button"
              class="text-tertiary hover:text-accent flex items-center gap-0.5 outline-none"
              title="Stage all"
              @click="emit('stage-all')"
            >
              <CheckIcon class="size-3" />
              <span class="text-copy">All</span>
            </button>
          </div>
          <div class="flex flex-col gap-0.5">
            <OHover
              v-for="file in unstagedFiles"
              :key="file.path"
              :active="selectedFile === file.path"
              full-width
              class="group/file cursor-default"
            >
              <div class="flex w-full items-center gap-1 px-1.5 py-1">
                <button
                  type="button"
                  class="grid size-4 shrink-0 place-items-center rounded outline-none"
                  title="Mark as viewed"
                  @click.stop="emit('toggle-viewed', file.path)"
                >
                  <DocumentIcon class="text-tertiary size-3 group-hover/file:hidden" />
                  <PlusIcon class="text-accent size-3 hidden group-hover/file:block" />
                </button>
                <button
                  type="button"
                  class="text-copy text-primary min-w-0 flex-1 truncate text-left outline-none"
                  @click="emit('select-file', file.path, file.modifiedAfterStaged ? 'unstaged' : 'combined')"
                >
                  {{ file.path.split("/").pop() }}
                </button>
                <ChatBubbleLeftIcon
                  v-if="commentsByFile.get(file.path)"
                  class="text-accent size-3 shrink-0"
                  :title="`${commentsByFile.get(file.path)} comment${commentsByFile.get(file.path)! > 1 ? 's' : ''}`"
                />
                <span
                  class="text-copy shrink-0 font-mono"
                  :class="statusColors[file.status] || 'text-tertiary'"
                  :title="statusLabels[file.status] || file.status"
                >
                  {{ file.status }}
                </span>
              </div>
            </OHover>
          </div>
        </div>

        <!-- Staged / Viewed files -->
        <div v-if="stagedFiles.length" :class="unstagedFiles.length ? 'mt-3' : ''">
          <p class="text-label uppercase tracking-wide text-tertiary mb-1 px-2">
            Viewed ({{ stagedFiles.length }})
          </p>
          <div class="flex flex-col gap-0.5">
            <OHover
              v-for="file in stagedFiles"
              :key="file.path"
              :active="selectedFile === file.path"
              full-width
              class="cursor-default"
            >
              <div class="flex w-full items-center gap-1 px-1.5 py-1">
                <button
                  type="button"
                  class="text-accent hover:text-primary grid size-4 shrink-0 place-items-center rounded outline-none"
                  title="Mark as unviewed"
                  @click.stop="emit('toggle-viewed', file.path)"
                >
                  <CheckIcon class="size-3" />
                </button>
                <button
                  type="button"
                  class="text-copy text-tertiary min-w-0 flex-1 truncate text-left outline-none"
                  @click="emit('select-file', file.path, 'staged')"
                >
                  {{ file.path.split("/").pop() }}
                </button>
                <ChatBubbleLeftIcon
                  v-if="commentsByFile.get(file.path)"
                  class="text-accent size-3 shrink-0 opacity-50"
                  :title="`${commentsByFile.get(file.path)} comment${commentsByFile.get(file.path)! > 1 ? 's' : ''}`"
                />
                <span
                  class="text-copy shrink-0 font-mono opacity-50"
                  :class="statusColors[file.status] || 'text-tertiary'"
                >
                  {{ file.status }}
                </span>
              </div>
            </OHover>
          </div>
        </div>
      </template>
    </div>

    <!-- Commit & actions -->
    <div class="border-neutral flex flex-col gap-2 border-t p-2">
      <textarea
        v-model="commitMessageInput"
        class="text-copy text-primary placeholder:text-tertiary bg-subtle border-neutral w-full resize-none rounded-md border p-2 outline-none focus:border-neutral-strong"
        rows="3"
        placeholder="Commit message..."
        :disabled="committing"
        @keydown.enter.meta.prevent="handleCommit"
      />
      <p v-if="commitError" class="text-copy text-danger px-0.5 text-sm">
        {{ commitError }}
      </p>
      <div class="flex gap-1.5">
        <OButton
          variant="primary"
          size="sm"
          class="flex-1"
          :disabled="!commitMessageInput.trim() || !stagedFiles.length || committing"
          :loading="committing"
          @click="handleCommit"
        >
          Commit
        </OButton>
        <OButton
          v-if="ahead > 0"
          variant="transparent"
          size="sm"
          :icon-left="ArrowUpTrayIcon"
          :loading="pushing"
          :title="remoteExists ? `Push ${ahead} commit${ahead !== 1 ? 's' : ''} to origin/${branch}` : `Push branch ${branch} to origin`"
          @click="emit('push')"
        >
          <template v-if="remoteExists">
            Push <span class="text-tertiary ml-0.5">({{ ahead }})</span>
          </template>
          <template v-else>
            Push
          </template>
        </OButton>
      </div>
      <p v-if="pushError" class="text-copy text-danger px-0.5 text-sm">
        {{ pushError }}
      </p>
    </div>
  </div>
</template>
