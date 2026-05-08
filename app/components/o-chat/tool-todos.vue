<script setup lang="ts">
import {
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/vue/16/solid";

type Todo = {
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
};

type Props = {
  todos: Todo[];
  isLatest?: boolean;
};

const { todos, isLatest = false } = defineProps<Props>();

const expanded = ref(isLatest);

const completedCount = computed(() => todos.filter((t) => t.status === "completed").length);
const totalCount = computed(() => todos.length);
const allDone = computed(() => completedCount.value === totalCount.value);
const hasInProgress = computed(() => todos.some((t) => t.status === "in_progress"));

const statusIcon: Record<string, any> = {
  completed: CheckCircleIcon,
  cancelled: XCircleIcon,
};

const statusClass: Record<string, string> = {
  pending: "border-edge bg-base-3",
  in_progress: "text-primary",
  completed: "text-success",
  cancelled: "text-tertiary",
};
</script>

<template>
  <div
    class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1 text-left transition-colors hover:bg-surface-1"
    :class="expanded ? 'bg-surface-1' : ''"
    @click="expanded = !expanded"
  >
    <ClipboardDocumentListIcon class="text-tertiary size-3.5 shrink-0" />
    <span class="text-copy text-secondary shrink-0">Todos</span>
    <span class="text-copy text-tertiary min-w-0 flex-1 truncate">{{ completedCount }}/{{ totalCount }}</span>
    <OLoader
      v-if="hasInProgress"
      size="xs"
      class="text-primary shrink-0"
    />
    <CheckCircleIcon v-else-if="allDone" class="text-success size-3 shrink-0" />
  </div>

  <div v-if="expanded" class="mb-1 mt-0.5">
    <div class="flex flex-col gap-0.5 py-1 px-3">
      <div
        v-for="(todo, i) in todos"
        :key="i"
        class="flex items-start gap-2 py-0.5"
        :class="todo.status === 'cancelled' ? 'opacity-40' : ''"
      >
        <div class="mt-0.5 flex shrink-0 items-center">
          <OLoader
            v-if="todo.status === 'in_progress'"
            size="xs"
            class="text-primary"
          />
          <component
            v-else-if="statusIcon[todo.status]"
            :is="statusIcon[todo.status]"
            class="size-3.5"
            :class="statusClass[todo.status]"
          />
          <div
            v-else
            class="size-3.5 rounded border"
            :class="statusClass[todo.status]"
          />
        </div>
        <span
          class="text-copy leading-snug"
          :class="{
            'text-primary': todo.status === 'in_progress',
            'text-secondary': todo.status === 'pending',
            'text-tertiary line-through': todo.status === 'completed' || todo.status === 'cancelled',
          }"
        >
          {{ todo.content }}
        </span>
      </div>
    </div>
  </div>
</template>
