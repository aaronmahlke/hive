<script setup lang="ts">
import { ArrowUpIcon, StopIcon } from "@heroicons/vue/16/solid";
import { useTextareaAutosize, useEventListener } from "@vueuse/core";

type Props = {
  disabled?: boolean;
  placeholder?: string;
  isWorking?: boolean;
};

type Emits = {
  send: [text: string];
  abort: [];
};

const emit = defineEmits<Emits>();

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: "Send a message...",
  isWorking: false,
});

// Textarea with auto-resize
const textareaEl = useTemplateRef<HTMLTextAreaElement>("textarea");
const { input: message, triggerResize } = useTextareaAutosize({ element: textareaEl });

function handleSend() {
  const trimmed = message.value.trim();
  if (!trimmed || props.disabled) return;
  emit("send", trimmed);
  message.value = "";
  triggerResize();
}

useEventListener(textareaEl, "keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
  if (e.key === "Escape" && props.isWorking) {
    e.preventDefault();
    emit("abort");
  }
});

defineExpose({ focus: () => textareaEl.value?.focus() });
</script>

<template>
  <div
    class="relative overflow-hidden transition-colors"
    :class="props.disabled ? 'opacity-40' : ''"
  >
    <textarea
      ref="textarea"
      v-model="message"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      rows="1"
      class="text-copy text-primary placeholder:text-tertiary block min-h-[2.25rem] w-full resize-none bg-transparent px-3 pt-2.5 pb-1.5 outline-none"
    />

    <div class="flex items-center justify-end px-2.5 pb-2">
      <div class="flex items-center gap-1.5">
        <OButton
          v-if="props.isWorking"
          variant="danger-solid"
          :icon-left="StopIcon"
          title="Stop generation (Escape)"
          @click="emit('abort')"
        />
        <OButton
          v-else
          variant="inverse"
          :icon-left="ArrowUpIcon"
          :class="!message.trim() || props.disabled ? 'opacity-20 scale-90' : ''"
          @click="handleSend"
        />
      </div>
    </div>
  </div>
</template>
