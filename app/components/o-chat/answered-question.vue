<script setup lang="ts">
import { QuestionMarkCircleIcon, ChevronRightIcon, CheckCircleIcon } from "@heroicons/vue/16/solid";

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
  <div class="px-3 py-1">
    <button
      type="button"
      class="text-copy text-tertiary hover:text-secondary flex items-center gap-1.5 outline-none"
      @click="expanded = !expanded"
    >
      <ChevronRightIcon
        class="size-3.5 transition-transform"
        :class="expanded ? 'rotate-90' : ''"
      />
      <QuestionMarkCircleIcon class="size-3.5" />
      <span class="text-secondary">{{ summary }}</span>
    </button>

    <div v-if="expanded" class="bg-surface-1 mt-1 ml-5 rounded-md px-3 py-2">
      <div
        v-for="(q, idx) in data.questions"
        :key="idx"
        :class="idx > 0 ? 'border-edge mt-2 border-t pt-2' : ''"
      >
        <p class="text-copy text-tertiary mb-1">{{ q.header || q.question }}</p>
        <div class="flex items-center gap-1.5">
          <CheckCircleIcon class="text-success size-3 shrink-0" />
          <span class="text-copy text-primary">
            {{ data.answers[idx]?.join(", ") || "No answer" }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
