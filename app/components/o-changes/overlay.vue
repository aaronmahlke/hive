<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";

type Props = {
  filePath: string;
  fileDiff: any | null;
  fileContent: string | null;
  loadingContent: boolean;
  comments: any[];
};

type Emits = {
  close: [];
  "add-comment": [comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
  }];
  "delete-comment": [commentId: string];
};

const {
  filePath,
  fileDiff = null,
  fileContent = null,
  loadingContent = false,
  comments,
} = defineProps<Props>();
const emit = defineEmits<Emits>();

const hasDiff = computed(() => !!fileDiff);
const hasContent = computed(() => fileContent !== null);
</script>

<template>
  <div class="bg-base-1 absolute inset-0 z-10 flex flex-col overflow-hidden">
    <!-- File header -->
    <div class="border-edge flex h-10 shrink-0 items-center justify-between border-b px-3">
      <div class="flex min-w-0 items-center gap-2">
        <span class="text-copy-sm text-primary truncate font-mono">
          {{ filePath }}
        </span>
        <span
          v-if="!hasDiff && hasContent"
          class="text-copy-xs text-tertiary shrink-0 rounded bg-surface-1 px-1.5 py-0.5"
        >
          new file
        </span>
      </div>
      <button
        type="button"
        class="text-tertiary hover:text-primary grid size-6 shrink-0 place-items-center rounded outline-none"
        title="Close (Escape)"
        @click="emit('close')"
      >
        <XMarkIcon class="size-4" />
      </button>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-auto">
      <!-- Diff view -->
      <OChangesDiffViewer
        v-if="hasDiff"
        :file-diff="fileDiff"
        :file-path="filePath"
        :comments="comments"
        @add-comment="emit('add-comment', $event)"
        @delete-comment="emit('delete-comment', $event)"
      />

      <!-- Plain file view (new/untracked files) -->
      <OChangesFileViewer
        v-else-if="hasContent"
        :content="fileContent!"
        :file-path="filePath"
      />

      <!-- Loading -->
      <div
        v-else-if="loadingContent"
        class="flex h-full items-center justify-center gap-2"
      >
        <ArrowPathIcon class="text-tertiary size-4 animate-spin" />
        <span class="text-copy-sm text-tertiary">Loading file...</span>
      </div>

      <!-- Fallback -->
      <div v-else class="text-copy-sm text-tertiary flex h-full items-center justify-center">
        No content available
      </div>
    </div>
  </div>
</template>
