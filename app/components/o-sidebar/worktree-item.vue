<script setup lang="ts">
import {
  HomeIcon,
  CodeBracketIcon,
  XMarkIcon,
} from "@heroicons/vue/16/solid";

type Props = {
  branchName: string;
  agentStatus: string;
  pendingSignals: number;
  isMain?: boolean;
  active?: boolean;
  removable?: boolean;
};

type Emits = {
  click: [];
  remove: [e: Event];
};

const {
  branchName,
  agentStatus,
  pendingSignals = 0,
  isMain = false,
  active = false,
  removable = false,
} = defineProps<Props>();

const emit = defineEmits<Emits>();

const statusClasses: Record<string, string> = {
  idle: "bg-inverse/30",
  working: "bg-accent",
  question: "bg-warn",
  done: "bg-success",
  error: "bg-danger",
};
</script>

<template>
  <OHover
    full-width
    :active="active"
    class="cursor-pointer"
    @click="emit('click')"
  >
    <div class="flex w-full items-center justify-between px-2 py-1.5">
      <div class="flex min-w-0 items-center gap-2">
        <component
          :is="isMain ? HomeIcon : CodeBracketIcon"
          class="text-tertiary size-3.5 shrink-0"
        />
        <span class="text-copy-sm text-primary truncate">
          {{ branchName }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <span
          v-if="pendingSignals > 0"
          class="bg-warn text-warn-on text-copy-xs grid size-4 place-items-center rounded-full font-medium"
        >
          {{ pendingSignals }}
        </span>
        <button
          type="button"
          class="grid size-5 place-items-center rounded"
          :title="removable ? 'Remove worktree' : undefined"
          @click.stop="removable ? emit('remove', $event) : undefined"
        >
          <XMarkIcon
            v-if="removable"
            class="text-tertiary hover:text-danger hidden size-3 group-hover/h:block"
          />
          <span
            class="inline-block size-2 rounded-full"
            :class="[
              statusClasses[agentStatus] || statusClasses.idle,
              agentStatus === 'working' ? 'animate-pulse' : '',
              removable ? 'group-hover/h:hidden' : '',
            ]"
          />
        </button>
      </div>
    </div>
  </OHover>
</template>
