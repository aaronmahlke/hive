<script setup lang="ts">
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
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

const statusIcon: Record<string, any> = {
  completed: CheckCircleIcon,
  cancelled: XCircleIcon,
  in_progress: ArrowPathIcon,
};

const statusClass: Record<string, string> = {
  pending: "border-edge bg-base-3",
  in_progress: "text-accent",
  completed: "text-success",
  cancelled: "text-tertiary",
};

const priorityDot: Record<string, string> = {
  high: "bg-danger",
  medium: "bg-warn",
  low: "bg-inverse/20",
};
</script>

<template>
  <div class="px-5 py-1">
    <button
      type="button"
      class="text-copy-sm text-secondary hover:text-primary flex items-center gap-2 outline-none"
      @click="expanded = !expanded"
    >
      <ClipboardDocumentListIcon class="text-tertiary size-3.5 shrink-0" />
      <span>Todos</span>
      <span class="text-tertiary">{{ completedCount }}/{{ totalCount }}</span>
    </button>

    <div v-if="expanded" class="mt-1.5 ml-5.5 flex flex-col gap-0.5">
      <div
        v-for="(todo, i) in todos"
        :key="i"
        class="flex items-start gap-2 py-0.5"
        :class="todo.status === 'cancelled' ? 'opacity-40' : ''"
      >
        <div class="mt-0.5 flex shrink-0 items-center">
          <component
            v-if="statusIcon[todo.status]"
            :is="statusIcon[todo.status]"
            class="size-3.5"
            :class="[
              statusClass[todo.status],
              todo.status === 'in_progress' ? 'animate-spin' : '',
            ]"
          />
          <div
            v-else
            class="size-3.5 rounded border"
            :class="statusClass[todo.status]"
          />
        </div>
        <span
          class="text-copy-sm leading-snug"
          :class="{
            'text-primary': todo.status === 'in_progress',
            'text-secondary': todo.status === 'pending',
            'text-tertiary line-through': todo.status === 'completed' || todo.status === 'cancelled',
          }"
        >
          {{ todo.content }}
        </span>
        <span
          class="mt-1 inline-block size-1.5 shrink-0 rounded-full"
          :class="priorityDot[todo.priority]"
          :title="todo.priority"
        />
      </div>
    </div>
  </div>
</template>
