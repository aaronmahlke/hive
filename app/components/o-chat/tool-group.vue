<script setup lang="ts">
type Part = {
  type: string;
  tool?: string;
  callID?: string;
  state?: any;
  [key: string]: any;
};

type Props = {
  tools: Part[];
  isLast?: boolean;
  isWorking?: boolean;
  statusText?: string;
  formattedDuration?: string;
};

type Emits = {
  abort: [];
};

const { tools, isLast = false } = defineProps<Props>();
const emit = defineEmits<Emits>();

const lastTodoIndex = computed(() => {
  if (!isLast) return -1;
  for (let i = tools.length - 1; i >= 0; i--) {
    if (tools[i].tool === "todowrite") return i;
  }
  return -1;
});
</script>

<template>
  <div class="flex flex-col">
    <template v-for="(tool, i) in tools" :key="tool.callID || tool.tool">
      <OChatToolTodos
        v-if="tool.tool === 'todowrite' && tool.state?.input?.todos"
        :todos="tool.state.input.todos"
        :is-latest="i === lastTodoIndex"
      />
      <OChatToolCall
        v-else
        :part="tool as any"
      />
    </template>
  </div>
</template>
