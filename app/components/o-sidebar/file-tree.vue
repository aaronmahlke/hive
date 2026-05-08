<script setup lang="ts">
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  ChevronRightIcon,
} from "@heroicons/vue/16/solid";

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

type Props = {
  nodes: FileNode[];
  depth?: number;
};

const { nodes, depth = 0 } = defineProps<Props>();

const expandedDirs = reactive<Set<string>>(new Set());

function toggleDir(path: string) {
  if (expandedDirs.has(path)) {
    expandedDirs.delete(path);
  } else {
    expandedDirs.add(path);
  }
}

function isExpanded(path: string): boolean {
  return expandedDirs.has(path);
}
</script>

<template>
  <div>
    <div v-for="node in nodes" :key="node.path">
      <OHover
        v-if="node.type === 'directory'"
        full-width
        class="cursor-pointer"
        @click="toggleDir(node.path)"
      >
        <div
          class="flex w-full items-center gap-1 px-2 py-0.5"
          :style="{ paddingLeft: `${depth * 12 + 8}px` }"
        >
          <ChevronRightIcon
            class="text-tertiary size-3 shrink-0 transition-transform"
            :class="isExpanded(node.path) ? 'rotate-90' : ''"
          />
          <component
            :is="isExpanded(node.path) ? FolderOpenIcon : FolderIcon"
            class="text-tertiary size-3.5 shrink-0"
          />
          <span class="text-copy text-primary truncate">
            {{ node.name }}
          </span>
        </div>
      </OHover>

      <OHover
        v-else
        full-width
        class="cursor-default"
      >
        <div
          class="flex w-full items-center gap-1 px-2 py-0.5"
          :style="{ paddingLeft: `${depth * 12 + 20}px` }"
        >
          <DocumentIcon class="text-tertiary size-3.5 shrink-0" />
          <span class="text-copy text-secondary truncate">
            {{ node.name }}
          </span>
        </div>
      </OHover>

      <!-- Recursive children -->
      <OSidebarFileTree
        v-if="node.type === 'directory' && isExpanded(node.path) && node.children?.length"
        :nodes="node.children"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>
