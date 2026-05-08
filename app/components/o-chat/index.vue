<script setup lang="ts">
type Mode = "build" | "plan";

type Props = {
  projectId: string;
  placeholder?: string;
};

const { projectId, placeholder } = defineProps<Props>();

const store = useHiveStore();
const { turns, messages, isWorking, pendingQuestions, pendingPermissions, pendingOcQuestions, answeredQuestions, modelName, connected, initializing, sessionId } = store.project(projectId);

// Only show permissions/questions for the active session in the prompt area.
// Child session permissions are shown inline in the task tool call component.
const activePermissions = computed(() =>
  pendingPermissions.value.filter((p) => p.sessionID === sessionId.value),
);
const activeOcQuestions = computed(() =>
  pendingOcQuestions.value.filter((q) => q.sessionID === sessionId.value),
);

const storageKey = computed(() => `hive:chat:${projectId}`);
const mode = useLocalStorage<Mode>(`${storageKey.value}:mode`, "build");
const draft = useLocalStorage(`${storageKey.value}:draft`, "");
const { selectedModelId } = useSelectedModel(projectId);

watch(modelName, (name) => {
  if (name && !selectedModelId.value) {
    selectedModelId.value = name;
  }
});
const scrollArea = ref<HTMLDivElement>();
const messageQueue = ref<string[]>([]);

// Auto-dequeue when agent finishes
watch(isWorking, (working, wasWorking) => {
  if (wasWorking && !working && messageQueue.value.length > 0) {
    const next = messageQueue.value.shift()!;
    store.sendPrompt(projectId, next, { agent: mode.value });
  }
});

function handleSend(text: string, attachments?: { type: "file"; mime: string; url: string; filename: string }[]) {
  draft.value = "";
  if (isWorking.value) {
    messageQueue.value.push(text);
  } else {
    store.sendPrompt(projectId, text, { agent: mode.value, attachments, ...(selectedModelId.value && { model: selectedModelId.value }) });
    stickToBottom.value = true;
    scrollToBottom();
  }
}

function removeFromQueue(index: number) {
  messageQueue.value.splice(index, 1);
}

function handleAbort() {
  store.abort(projectId);
}

function handleResolveQuestion(signalId: string, answer: string) {
  store.resolveSignal(projectId, signalId, answer);
}

function handleReplyPermission(requestId: string, reply: "once" | "always" | "reject", sessionId?: string) {
  store.replyPermission(projectId, requestId, reply, sessionId);
}

function handleReplyOcQuestion(requestId: string, answers: string[][]) {
  store.replyQuestion(projectId, requestId, answers);
}

function handleRejectOcQuestion(requestId: string) {
  store.rejectQuestion(projectId, requestId);
}

function handleCopy(text: string) {
  if (text) navigator.clipboard.writeText(text);
}

function handleRevert(messageId: string) {
  // Extract the message text, revert immediately, populate input
  const msg = messages.value.find((m) => m.info.id === messageId);
  if (!msg) return;
  const text = msg.parts
    ?.filter((p: any) => p.type === "text" && !p.synthetic)
    .map((p: any) => p.text)
    .join("") || "";

  store.revertMessage(projectId, messageId);
  if (text) {
    draft.value = text;
  }
}

function handleEditLast() {
  const allMsgs = messages.value;
  for (let i = allMsgs.length - 1; i >= 0; i--) {
    if (allMsgs[i].info.role === "user") {
      handleRevert(allMsgs[i].info.id);
      return;
    }
  }
}

function handleFork(messageId: string) {
  store.forkSession(projectId, messageId);
  // Watch for the forked session to arrive and switch to it
  const unwatch = watch(
    () => store.connection(projectId).state.value?._lastForkedSessionId,
    (newId) => {
      if (newId) {
        store.connection(projectId).state.value!._lastForkedSessionId = undefined;
        store.switchSession(projectId, newId);
        unwatch();
      }
    },
  );
}

// ── Scroll management via MutationObserver + ResizeObserver ──

const stickToBottom = ref(true);
let mutationObs: MutationObserver | null = null;
let resizeObs: ResizeObserver | null = null;

function scrollToBottom() {
  if (!scrollArea.value || !stickToBottom.value) return;
  scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
}

function onScroll() {
  if (!scrollArea.value) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollArea.value;
  stickToBottom.value = scrollTop + clientHeight >= scrollHeight - 40;
}

onMounted(() => {
  const el = scrollArea.value;
  if (!el) return;

  // Observe DOM mutations (new message elements added)
  mutationObs = new MutationObserver(() => scrollToBottom());
  mutationObs.observe(el, { childList: true, subtree: true });

  // Observe content size changes (markdown rendering, code blocks expanding)
  resizeObs = new ResizeObserver(() => scrollToBottom());
  for (const child of el.children) {
    resizeObs.observe(child);
  }
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && pendingOcQuestions.value.length) {
    handleRejectOcQuestion(pendingOcQuestions.value[0].id);
  }
}

onMounted(() => {
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  mutationObs?.disconnect();
  resizeObs?.disconnect();
  document.removeEventListener("keydown", onKeydown);
});

// Force scroll on initial load
watch(initializing, (val, old) => {
  if (old && !val) {
    stickToBottom.value = true;
    nextTick(() => scrollToBottom());
  }
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div ref="scrollArea" class="min-h-0 flex-1 overflow-y-auto pb-4" @scroll="onScroll">
      <div
        v-if="!turns.length && !isWorking"
        class="flex h-full items-center justify-center"
      >
        <p v-if="initializing" class="text-copy text-tertiary flex items-center gap-2">
          <span class="bg-accent inline-block size-2 animate-pulse rounded-full" />
          Starting agent...
        </p>
        <p v-else class="text-copy text-tertiary">
          {{ connected ? "Send a message to start." : "Connecting..." }}
        </p>
      </div>

      <div v-else class="mx-auto max-w-3xl px-3">
        <OChatTurn
          v-for="(turn, i) in turns"
          :key="turn.userMessage.info.id"
          :user-message="turn.userMessage"
          :assistant-messages="turn.assistantMessages"
          :is-working="isWorking && i === turns.length - 1"
          :answered-questions="answeredQuestions"
          :connection-key="projectId"
          @abort="handleAbort"
          @copy="handleCopy"
          @revert="handleRevert"
          @fork="handleFork"
        />
      </div>
    </div>

    <div class="relative z-10 shrink-0 -mt-4">
      <div class="mx-auto max-w-3xl px-3 pb-3">
        <div class="bg-base-2 rounded-[14px] p-1">
          <OChatPermission
            v-for="p in activePermissions"
            :key="p.id"
            :permission="p"
            @reply="handleReplyPermission"
          />

          <OChatOcQuestion
            v-for="q in activeOcQuestions"
            :key="q.id"
            :request="q"
            @reply="handleReplyOcQuestion"
            @reject="handleRejectOcQuestion"
          />

          <OChatQuestion
            v-for="q in pendingQuestions"
            :key="q.id"
            :signal="q"
            @resolve="handleResolveQuestion"
          />

          <div
            v-if="(activePermissions.length || activeOcQuestions.length || pendingQuestions.length) && messageQueue.length"
            class="border-neutral mx-3 border-t"
          />

          <OChatQueue
            :messages="messageQueue"
            @remove="removeFromQueue"
          />

          <div class="bg-base-3 border-neutral rounded-xl border">
            <OChatInput
              v-model:draft="draft"
              :disabled="!connected"
              :placeholder="placeholder || 'Send a message...'"
              :is-working
              :project-id="projectId"
              :model-id="selectedModelId"
              :mode
              @send="handleSend"
              @abort="handleAbort"
              @update:mode="mode = $event"
              @update:model-id="selectedModelId = $event"
              @edit-last="handleEditLast"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
