<script setup lang="ts">
import { DocumentIcon, FolderIcon, FolderOpenIcon, ChevronRightIcon } from "@heroicons/vue/16/solid";
import type { FileTreeNode } from "~/../../server/api/projects/[id]/file-tree.get";

type Props = {
  nodes: FileTreeNode[];
  depth?: number;
  selectedFile?: string | null;
};

const { nodes, depth = 0, selectedFile = null } = defineProps<Props>();
const emit = defineEmits<{ select: [path: string] }>();

function collectDirPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "dir") {
      paths.push(node.path);
      paths.push(...collectDirPaths(node.children));
    }
  }
  return paths;
}

const collapsed = ref<Set<string>>(new Set(collectDirPaths(nodes)));

function toggle(path: string) {
  const next = new Set(collapsed.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  collapsed.value = next;
}
</script>

<template>
  <div>
    <template v-for="node in nodes" :key="node.path">
      <!-- Directory -->
      <template v-if="node.type === 'dir'">
        <OHover full-width class="cursor-default">
          <button
            type="button"
            class="flex w-full items-center gap-1 py-0.5 text-left outline-none"
            :style="{ paddingLeft: `${0.375 + depth * 0.875}rem` }"
            @click="toggle(node.path)"
          >
            <ChevronRightIcon
              class="text-tertiary size-4 shrink-0 transition-transform"
              :class="!collapsed.has(node.path) ? 'rotate-90' : ''"
            />
            <component
              :is="collapsed.has(node.path) ? FolderIcon : FolderOpenIcon"
              class="text-tertiary size-4 shrink-0"
            />
            <span class="text-copy text-primary truncate">{{ node.name }}</span>
          </button>
        </OHover>
        <OSidebarFileTree
          v-if="!collapsed.has(node.path)"
          :nodes="node.children"
          :depth="depth + 1"
          :selected-file="selectedFile"
          @select="emit('select', $event)"
        />
      </template>

      <!-- File -->
      <OHover
        v-else
        full-width
        :active="selectedFile === node.path"
        class="cursor-default"
      >
        <button
          type="button"
          class="flex w-full items-center gap-1.5 py-0.5 text-left outline-none"
          :style="{ paddingLeft: `${0.375 + depth * 0.875 + 1.25}rem` }"
          @click="emit('select', node.path)"
        >
          <DocumentIcon class="text-tertiary size-4 shrink-0" />
          <span
            class="text-copy truncate"
            :class="selectedFile === node.path ? 'text-primary' : 'text-secondary'"
          >
            {{ node.name }}
          </span>
        </button>
      </OHover>
    </template>
  </div>
</template>
