<script setup lang="ts">
type Part = {
  type: string;
  tool?: string;
  callID?: string;
  state?: any;
  [key: string]: any;
};

type AnsweredQuestion = {
  id: string;
  questions: { question: string; header: string }[];
  answers: string[][];
  toolCallID?: string;
};

type Props = {
  tools: Part[];
  isLast?: boolean;
  isWorking?: boolean;
  statusText?: string;
  formattedDuration?: string;
  connectionKey?: string;
  answeredQuestions?: AnsweredQuestion[];
};

type Emits = {
  abort: [];
};

const { tools, isLast = false, connectionKey = "", answeredQuestions = [] } = defineProps<Props>();
const emit = defineEmits<Emits>();

const lastTodoIndex = computed(() => {
  if (!isLast) return -1;
  for (let i = tools.length - 1; i >= 0; i--) {
    if (tools[i].tool === "todowrite") return i;
  }
  return -1;
});

function answeredForTool(tool: Part): AnsweredQuestion | undefined {
  if (!tool.callID) return undefined;
  return answeredQuestions.find((aq) => aq.toolCallID === tool.callID);
}
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <template v-for="(tool, i) in tools" :key="tool.callID || tool.tool">
      <OChatToolTodos
        v-if="tool.tool === 'todowrite' && tool.state?.input?.todos"
        :todos="tool.state.input.todos"
        :is-latest="i === lastTodoIndex"
      />
      <OChatAnsweredQuestion
        v-else-if="answeredForTool(tool)"
        :data="answeredForTool(tool)!"
      />
      <OChatToolTask
        v-else-if="tool.tool === 'task' && connectionKey"
        :part="tool as any"
        :connection-key="connectionKey"
      />
      <OChatToolCall
        v-else
        :part="tool as any"
      />
    </template>
  </div>
</template>
