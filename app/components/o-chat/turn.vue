<script setup lang="ts">
import {
  ChevronDownIcon,
  ClipboardIcon,
  CheckIcon,
  StopIcon,
} from "@heroicons/vue/16/solid";
import { ArrowPathIcon } from "@heroicons/vue/20/solid";

type Part = {
  type: string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: any;
  [key: string]: any;
};

type Message = {
  info: {
    role: "user" | "assistant";
    id: string;
    sessionID: string;
    time?: { created: number };
    modelID?: string;
    providerID?: string;
    agent?: string;
    [key: string]: any;
  };
  parts: Part[];
};

type Props = {
  userMessage: Message;
  assistantMessages: Message[];
  isWorking?: boolean;
};

type Emits = {
  abort: [];
};

const { userMessage, assistantMessages, isWorking = false } = defineProps<Props>();
const emit = defineEmits<Emits>();

const userText = computed(() => {
  return userMessage.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("\n");
});

// Show full text only if multi-line - title handles single-line display
const isMultiLine = computed(() => userText.value.includes("\n"));

const toolCalls = computed(() => {
  const tools: Part[] = [];
  for (const msg of assistantMessages) {
    for (const part of msg.parts) {
      if (part.type === "tool") {
        tools.push(part);
      }
    }
  }
  return tools;
});

const responseText = computed(() => {
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const textParts = assistantMessages[i].parts.filter(
      (p) => p.type === "text" && p.text,
    );
    if (textParts.length > 0) {
      return textParts.map((p) => p.text!).join("\n");
    }
  }
  return "";
});

const showSteps = ref(false);
const hasSteps = computed(() => toolCalls.value.length > 0);

watch(() => isWorking, (working) => {
  if (working) showSteps.value = true;
});

// Duration timer
const startTime = ref<number | null>(null);
const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

watch(() => isWorking, (working) => {
  if (working && !startTime.value) {
    startTime.value = Date.now();
    timer = setInterval(() => {
      elapsed.value = Math.floor((Date.now() - startTime.value!) / 1000);
    }, 1000);
  } else if (!working && timer) {
    clearInterval(timer);
    timer = null;
  }
}, { immediate: true });

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const formattedDuration = computed(() => {
  if (!elapsed.value) return "";
  const m = Math.floor(elapsed.value / 60);
  const s = elapsed.value % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
});

const copied = ref(false);
async function copyResponse() {
  if (!responseText.value) return;
  await navigator.clipboard.writeText(responseText.value);
  copied.value = true;
  setTimeout(() => { copied.value = false }, 2000);
}

const statusText = computed(() => {
  if (!isWorking) return "";
  const lastTool = toolCalls.value[toolCalls.value.length - 1];
  if (!lastTool) return "Thinking";
  switch (lastTool.tool) {
    case "read": return "Gathering context";
    case "glob": case "grep": case "codesearch": return "Searching codebase";
    case "edit": case "write": return "Making edits";
    case "bash": return "Running command";
    case "webfetch": case "websearch": return "Searching the web";
    case "task": return "Delegating work";
    case "todowrite": return "Planning";
    default: return "Working";
  }
});
</script>

<template>
  <div class="py-2">
    <div class="px-5 pb-2">
      <p class="text-copy text-primary whitespace-pre-wrap">{{ userText }}</p>
    </div>

    <div v-if="hasSteps || isWorking" class="px-5 py-1">
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="text-copy-sm text-tertiary hover:text-secondary flex items-center gap-1.5 outline-none"
          @click="showSteps = !showSteps"
        >
          <template v-if="isWorking">
            <ArrowPathIcon class="text-accent size-3.5 animate-spin" />
            <span class="text-secondary">{{ statusText }}</span>
            <span v-if="formattedDuration" class="text-tertiary font-mono">
              · {{ formattedDuration }}
            </span>
          </template>
          <template v-else>
            <ChevronDownIcon
              class="size-3.5 transition-transform"
              :class="showSteps ? '' : '-rotate-90'"
            />
            <span>{{ toolCalls.length }} step{{ toolCalls.length === 1 ? "" : "s" }}</span>
          </template>
        </button>

        <button
          v-if="isWorking"
          type="button"
          class="text-tertiary hover:text-danger ml-auto grid size-5 place-items-center rounded transition-colors"
          title="Stop (Escape)"
          @click.stop="emit('abort')"
        >
          <StopIcon class="size-3" />
        </button>
      </div>
    </div>

    <div v-if="showSteps && hasSteps" class="px-5 py-1">
      <div class="flex flex-col">
        <OChatToolCall
          v-for="tool in toolCalls"
          :key="tool.callID || tool.tool"
          :part="tool as any"
        />
      </div>
    </div>

    <div v-if="responseText" class="group/resp relative px-5 pt-2 pb-4">
      <button
        type="button"
        class="absolute top-2 right-5 grid size-6 place-items-center rounded opacity-0 transition-opacity outline-none group-hover/resp:opacity-100"
        :class="copied ? 'text-success' : 'text-tertiary hover:text-secondary'"
        @click="copyResponse"
      >
        <component :is="copied ? CheckIcon : ClipboardIcon" class="size-3.5" />
      </button>

      <OChatMarkdown :content="responseText" />
    </div>
  </div>
</template>
