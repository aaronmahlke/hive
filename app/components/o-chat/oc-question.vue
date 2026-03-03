<script setup lang="ts">
import {
  QuestionMarkCircleIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
} from "@heroicons/vue/16/solid";

type QuestionOption = {
  label: string;
  description: string;
};

type QuestionInfo = {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: { messageID: string; callID: string };
};

type Props = {
  request: QuestionRequest;
};

type Emits = {
  reply: [requestId: string, answers: string[][]];
  reject: [requestId: string];
};

const { request } = defineProps<Props>();
const emit = defineEmits<Emits>();

const activeTab = ref(0);
const selections = ref<string[][]>(request.questions.map(() => []));
const customInputs = ref<string[]>(request.questions.map(() => ""));
const showCustomInput = ref<boolean[]>(request.questions.map(() => false));

const currentQuestion = computed(() => request.questions[activeTab.value]);
const isLastTab = computed(() => activeTab.value === request.questions.length - 1);
const isSingleSimple = computed(() => request.questions.length === 1 && !request.questions[0].multiple);

function selectOption(qIdx: number, label: string) {
  const q = request.questions[qIdx];

  // Clear custom input when selecting an option
  showCustomInput.value[qIdx] = false;
  customInputs.value[qIdx] = "";

  if (q.multiple) {
    const current = selections.value[qIdx];
    const idx = current.indexOf(label);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(label);
    }
  } else {
    const current = selections.value[qIdx];
    if (current.length === 1 && current[0] === label) {
      // Deselect
      selections.value[qIdx] = [];
    } else {
      selections.value[qIdx] = [label];

      // Single question, single select — submit immediately
      if (isSingleSimple.value) {
        emit("reply", request.id, [[label]]);
        return;
      }

      // Auto-advance to next tab
      if (!isLastTab.value) {
        activeTab.value++;
      }
    }
  }
}

function activateCustom(qIdx: number) {
  showCustomInput.value[qIdx] = true;
  selections.value[qIdx] = [];
  nextTick(() => {
    const input = document.querySelector(`[data-custom-input="${qIdx}"]`) as HTMLInputElement;
    input?.focus();
  });
}

function submitCustom(qIdx: number) {
  const text = customInputs.value[qIdx]?.trim();
  if (!text) return;

  if (isSingleSimple.value) {
    emit("reply", request.id, [[text]]);
    return;
  }

  selections.value[qIdx] = [text];
  showCustomInput.value[qIdx] = false;

  if (!isLastTab.value) {
    activeTab.value++;
  }
}

function submitAll() {
  const answers = selections.value.map((sel, i) => {
    if (sel.length) return sel;
    const custom = customInputs.value[i]?.trim();
    return custom ? [custom] : [];
  });
  emit("reply", request.id, answers);
}

function goToTab(idx: number) {
  activeTab.value = idx;
}

function getAnswerPreview(qIdx: number): string {
  const sel = selections.value[qIdx];
  if (sel.length) return sel.join(", ");
  const custom = customInputs.value[qIdx]?.trim();
  if (custom) return custom;
  return "";
}
</script>

<template>
  <div class="px-3 py-2.5">
    <!-- Tabs (only if multiple questions) -->
    <div v-if="request.questions.length > 1" class="mb-2 flex items-center gap-1">
      <button
        v-for="(q, idx) in request.questions"
        :key="idx"
        type="button"
        class="text-copy-xs flex items-center gap-1 rounded px-2 py-1 transition-colors"
        :class="idx === activeTab
          ? 'bg-surface-1 text-primary font-medium'
          : getAnswerPreview(idx)
            ? 'text-success hover:bg-surface-1/50'
            : 'text-tertiary hover:bg-surface-1/50'"
        @click="goToTab(idx)"
      >
        <CheckIcon v-if="getAnswerPreview(idx) && idx !== activeTab" class="size-3" />
        {{ q.header || `Q${idx + 1}` }}
      </button>
    </div>

    <!-- Current question -->
    <div class="flex items-start gap-2">
      <QuestionMarkCircleIcon class="text-accent mt-0.5 size-4 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="text-copy-sm text-primary">{{ currentQuestion.question }}</p>

        <!-- Options -->
        <div v-if="currentQuestion.options?.length" class="mt-2 flex flex-col gap-1">
          <button
            v-for="opt in currentQuestion.options"
            :key="opt.label"
            type="button"
            class="text-copy-sm flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors"
            :class="selections[activeTab].includes(opt.label)
              ? 'bg-accent/10 border-accent text-primary'
              : 'bg-base-3 border-edge text-primary hover:bg-surface-1'"
            @click="selectOption(activeTab, opt.label)"
          >
            <span
              v-if="currentQuestion.multiple"
              class="border-edge grid size-3.5 shrink-0 place-items-center rounded border"
              :class="selections[activeTab].includes(opt.label) ? 'bg-accent border-accent' : ''"
            >
              <CheckIcon v-if="selections[activeTab].includes(opt.label)" class="text-accent-on size-2.5" />
            </span>
            <span class="flex-1">
              <span>{{ opt.label }}</span>
              <span v-if="opt.description" class="text-tertiary ml-1.5">{{ opt.description }}</span>
            </span>
          </button>

          <!-- Custom answer option -->
          <button
            v-if="currentQuestion.custom !== false"
            type="button"
            class="text-copy-sm flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors"
            :class="showCustomInput[activeTab]
              ? 'bg-accent/10 border-accent text-primary'
              : 'bg-base-3 border-edge text-tertiary hover:bg-surface-1 hover:text-primary'"
            @click="activateCustom(activeTab)"
          >
            Type your own answer
          </button>
        </div>

        <!-- Custom text input (shown when activated or no options) -->
        <div
          v-if="showCustomInput[activeTab] || !currentQuestion.options?.length"
          class="mt-2 flex gap-1.5"
        >
          <input
            :data-custom-input="activeTab"
            v-model="customInputs[activeTab]"
            class="text-copy-sm text-primary placeholder:text-tertiary bg-base-3 border-edge h-7 min-w-0 flex-1 rounded-md border px-2.5 outline-none"
            placeholder="Type your answer..."
            @keydown.enter.prevent="submitCustom(activeTab)"
            @keydown.escape.prevent="emit('reject', request.id)"
          />
          <button
            type="button"
            class="bg-inverse text-inverse grid size-7 shrink-0 place-items-center rounded-md transition-all"
            :class="!customInputs[activeTab]?.trim() ? 'opacity-20 scale-90' : 'hover:opacity-80'"
            @click="submitCustom(activeTab)"
          >
            <ArrowUpIcon class="size-3.5" />
          </button>
        </div>

        <!-- Navigation + Submit (multi-question) -->
        <div v-if="request.questions.length > 1" class="mt-3 flex items-center gap-1.5">
          <button
            v-if="activeTab > 0"
            type="button"
            class="text-copy-sm text-tertiary hover:text-primary flex items-center gap-0.5 rounded px-2 py-1 transition-colors"
            @click="activeTab--"
          >
            <ChevronLeftIcon class="size-3" />
            Back
          </button>
          <div class="flex-1" />
          <button
            v-if="!isLastTab"
            type="button"
            class="text-copy-sm text-tertiary hover:text-primary flex items-center gap-0.5 rounded px-2 py-1 transition-colors"
            @click="activeTab++"
          >
            Next
            <ChevronRightIcon class="size-3" />
          </button>
          <button
            v-if="isLastTab"
            type="button"
            class="bg-accent text-accent-on text-copy-sm rounded-md px-3 py-1 transition-colors hover:opacity-90"
            @click="submitAll"
          >
            Submit
          </button>
          <button
            type="button"
            class="text-copy-sm text-tertiary hover:text-danger rounded px-2 py-1 transition-colors"
            @click="emit('reject', request.id)"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
