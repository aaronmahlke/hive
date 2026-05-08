<script setup lang="ts">
import { QuestionMarkCircleIcon } from "@heroicons/vue/16/solid";

type AnsweredQuestion = {
  id: string;
  questions: { question: string; header: string }[];
  answers: string[][];
};

type Props = {
  data: AnsweredQuestion;
};

const { data } = defineProps<Props>();

const expanded = ref(false);

const summary = computed(() => {
  const parts: string[] = [];
  for (let i = 0; i < data.questions.length; i++) {
    const ans = data.answers[i];
    if (ans?.length) parts.push(ans.join(", "));
  }
  return parts.join(" · ") || "No answer";
});
</script>

<template>
  <div
    class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1 text-left transition-colors hover:bg-subtle"
    :class="expanded ? 'bg-subtle' : ''"
    @click="expanded = !expanded"
  >
    <QuestionMarkCircleIcon class="text-tertiary size-3.5 shrink-0" />
    <span class="text-copy text-secondary shrink-0">Question</span>
    <span class="text-copy text-tertiary min-w-0 flex-1 truncate">{{ summary }}</span>
  </div>

  <div v-if="expanded" class="mb-1 mt-0.5">
    <div class="bg-subtle rounded-md px-3 py-2">
      <div
        v-for="(q, idx) in data.questions"
        :key="idx"
        :class="idx > 0 ? 'border-neutral mt-2 border-t pt-2' : ''"
      >
        <p class="text-copy text-tertiary mb-0.5">{{ q.header || q.question }}</p>
        <div class="flex items-center gap-1.5">
          <CheckCircleIcon class="text-success size-3 shrink-0" />
          <span class="text-copy text-primary">{{ data.answers[idx]?.join(", ") || "No answer" }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
