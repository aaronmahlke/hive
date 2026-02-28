<script setup lang="ts">
import {
  DocumentCheckIcon,
  DocumentIcon,
  ArrowPathIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
} from "@heroicons/vue/16/solid";

type ChangedFile = {
  path: string;
  status: string;
};

type Props = {
  files: ChangedFile[];
  viewedFiles: Set<string>;
  selectedFile: string | null;
  commentCount: number;
  loading: boolean;
};

type Emits = {
  "select-file": [path: string];
  "toggle-viewed": [path: string];
  "request-changes": [];
  "approve": [];
  refresh: [];
};

const {
  files,
  viewedFiles,
  selectedFile = null,
  commentCount = 0,
  loading = false,
} = defineProps<Props>();

const emit = defineEmits<Emits>();

const unstagedFiles = computed(() =>
  files.filter((f) => !viewedFiles.has(f.path)),
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
    <OHeader title="Changes">
      <template #trailing>
        <span
          v-if="files.length"
          class="text-copy-xs text-tertiary"
        >
          {{ stagedFiles.length }}/{{ files.length }}
        </span>
        <OButton
          variant="transparent"
          size="xs"
          :icon-left="ArrowPathIcon"
          :class="loading ? 'animate-spin' : ''"
          @click="emit('refresh')"
        />
      </template>
    </OHeader>

    <div class="flex-1 overflow-auto p-1.5">
      <div
        v-if="!files.length && !loading"
        class="text-copy-sm text-tertiary px-2 py-4 text-center"
      >
        No changes
      </div>

      <div
        v-if="loading && !files.length"
        class="text-copy-sm text-tertiary flex items-center justify-center gap-2 px-2 py-4"
      >
        <ArrowPathIcon class="size-3.5 animate-spin" />
        Loading...
      </div>

      <template v-if="files.length">
        <!-- Unstaged files -->
        <div v-if="unstagedFiles.length">
          <p class="text-copy-xs text-tertiary mb-1 px-2 font-medium uppercase">
            Unstaged ({{ unstagedFiles.length }})
          </p>
          <div class="flex flex-col gap-0.5">
            <OHover
              v-for="file in unstagedFiles"
              :key="file.path"
              :active="selectedFile === file.path"
              full-width
              class="cursor-default"
            >
              <div class="flex w-full items-center gap-1.5 px-1.5 py-1">
                <button
                  type="button"
                  class="text-tertiary hover:text-primary grid size-4 shrink-0 place-items-center outline-none"
                  title="Mark as viewed"
                  @click.stop="emit('toggle-viewed', file.path)"
                >
                  <DocumentIcon class="size-3.5" />
                </button>
                <button
                  type="button"
                  class="text-copy-sm text-primary min-w-0 flex-1 truncate text-left outline-none"
                  @click="emit('select-file', file.path)"
                >
                  {{ file.path.split("/").pop() }}
                </button>
                <span
                  class="text-copy-xs shrink-0 font-mono"
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
          <p class="text-copy-xs text-tertiary mb-1 px-2 font-medium uppercase">
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
              <div class="flex w-full items-center gap-1.5 px-1.5 py-1">
                <button
                  type="button"
                  class="text-success hover:text-primary grid size-4 shrink-0 place-items-center outline-none"
                  title="Mark as unviewed"
                  @click.stop="emit('toggle-viewed', file.path)"
                >
                  <DocumentCheckIcon class="size-3.5" />
                </button>
                <button
                  type="button"
                  class="text-copy-sm text-secondary min-w-0 flex-1 truncate text-left line-through outline-none"
                  @click="emit('select-file', file.path)"
                >
                  {{ file.path.split("/").pop() }}
                </button>
                <span
                  class="text-copy-xs shrink-0 font-mono"
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

    <!-- Review actions -->
    <div v-if="files.length" class="border-edge flex flex-col gap-1.5 border-t p-2">
      <div v-if="commentCount" class="text-copy-xs text-tertiary flex items-center gap-1 px-0.5">
        <ChatBubbleLeftIcon class="size-3" />
        {{ commentCount }} comment{{ commentCount !== 1 ? "s" : "" }} pending
      </div>
      <OButton
        v-if="commentCount"
        variant="primary"
        size="md"
        class="w-full"
        @click="emit('request-changes')"
      >
        Request Changes
      </OButton>
      <OButton
        variant="transparent"
        size="md"
        class="w-full"
        :icon-left="CheckCircleIcon"
        :disabled="!allViewed"
        :title="allViewed ? 'Approve & commit changes' : 'Review all files first'"
        @click="emit('approve')"
      >
        Approve & Commit
      </OButton>
    </div>
  </div>
</template>
