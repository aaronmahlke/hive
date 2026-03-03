<script setup lang="ts">
import type { FileDiffMetadata } from "@pierre/diffs";

type ChangeComment = {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  side: "additions" | "deletions" | null;
  content: string;
  resolved: boolean;
};

type Props = {
  fileDiff: FileDiffMetadata;
  filePath: string;
  comments: ChangeComment[];
  diffMode?: "combined" | "staged" | "unstaged";
};

type Emits = {
  "add-comment": [comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
  }];
  "delete-comment": [commentId: string];
  "update-comment": [commentId: string, content: string];
};

const { fileDiff, filePath, comments, diffMode = "combined" } = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <ODiff
    :file-diff="fileDiff"
    :file-path="filePath"
    :comments="comments"
    :diff-mode="diffMode"
    @add-comment="emit('add-comment', $event)"
    @delete-comment="emit('delete-comment', $event)"
    @update-comment="(id, content) => emit('update-comment', id, content)"
  />
</template>
