<script setup lang="ts">
import { ArrowUpIcon, StopIcon, PhotoIcon } from "@heroicons/vue/16/solid";

type Mode = "build" | "plan";

type FileAttachment = {
  id: string;
  file: File;
  preview: string;
  dataUrl: string;
  mime: string;
  filename: string;
};

type Props = {
  disabled?: boolean;
  placeholder?: string;
  isWorking?: boolean;
  projectId?: string;
  modelId?: string;
  mode?: Mode;
};

type Emits = {
  send: [message: string, attachments: { type: "file"; mime: string; url: string; filename: string }[]];
  abort: [];
  "update:mode": [mode: Mode];
  "update:modelId": [id: string];
  "edit-last": [];
};

const {
  disabled = false,
  placeholder = "Send a message...",
  isWorking = false,
  projectId = "",
  modelId = "",
  mode = "build",
} = defineProps<Props>();

const emit = defineEmits<Emits>();

const message = defineModel<string>("draft", { default: "" });
const inputRef = ref<HTMLTextAreaElement>();
const attachments = ref<FileAttachment[]>([]);
const dragOver = ref(false);

function handleSend() {
  const trimmed = message.value.trim();
  if ((!trimmed && !attachments.value.length) || disabled) return;

  const files = attachments.value.map((a) => ({
    type: "file" as const,
    mime: a.mime,
    url: a.dataUrl,
    filename: a.filename,
  }));

  emit("send", trimmed, files);
  message.value = "";
  attachments.value = [];
  nextTick(() => {
    if (inputRef.value) inputRef.value.style.height = "auto";
  });
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
  if (e.key === "Tab") {
    e.preventDefault();
    toggleMode();
  }
  if (e.key === "Escape" && isWorking) {
    e.preventDefault();
    emit("abort");
  }
  if (e.key === "ArrowUp" && !message.value.trim() && !isWorking) {
    e.preventDefault();
    emit("edit-last");
  }
}

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = "auto";
  target.style.height = Math.min(target.scrollHeight, 200) + "px";
}

function toggleMode() {
  emit("update:mode", mode === "build" ? "plan" : "build");
}

function focusInput() {
  inputRef.value?.focus();
}

async function addImageFile(file: File) {
  if (!file.type.startsWith("image/")) return;

  const dataUrl = await fileToDataUrl(file);
  attachments.value.push({
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    file,
    preview: dataUrl,
    dataUrl,
    mime: file.type,
    filename: file.name || "pasted-image.png",
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) await addImageFile(file);
      return;
    }
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer?.types.some((t) => t === "Files")) {
    dragOver.value = true;
  }
}

function handleDragLeave() {
  dragOver.value = false;
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files) return;
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      await addImageFile(file);
    }
  }
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((a) => a.id !== id);
}

defineExpose({ focus: focusInput });
</script>

<template>
  <div
    class="overflow-hidden"
    :class="[
      disabled ? 'opacity-40' : '',
      dragOver ? 'ring-2 ring-accent ring-inset rounded-xl' : '',
    ]"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div v-if="attachments.length" class="flex flex-wrap gap-1.5 px-3 pt-2.5">
      <OChatAttachmentPill
        v-for="att in attachments"
        :key="att.id"
        :preview="att.preview"
        :name="att.file.name || 'Pasted image'"
        @remove="removeAttachment(att.id)"
      />
    </div>

    <textarea
      ref="inputRef"
      v-model="message"
      :placeholder
      :disabled
      rows="1"
      data-chat-input
      class="text-copy text-primary placeholder:text-tertiary block min-h-[2.75rem] w-full resize-none bg-transparent px-3 pt-3 pb-2 outline-none"
      @keydown="handleKeydown"
      @input="autoResize"
      @paste="handlePaste"
    />

    <div class="flex items-center justify-between px-2.5 pb-2">
      <div class="flex items-center gap-2">
        <OSegmentedControl
          :model-value="mode"
          :options="[
            { value: 'build', label: 'Build' },
            { value: 'plan', label: 'Plan' },
          ]"
          @update:model-value="emit('update:mode', $event as Mode)"
        />

        <OModelSelect
          v-if="projectId"
          :project-id="projectId"
          :model-id="modelId"
          @update:model-id="emit('update:modelId', $event)"
        />
      </div>

      <div class="flex items-center gap-1.5">
        <button
          v-if="isWorking"
          type="button"
          class="bg-danger text-danger-on grid size-6 place-items-center rounded-md transition-all hover:opacity-80"
          title="Stop generation (Escape)"
          @click="emit('abort')"
        >
          <StopIcon class="size-3" />
        </button>
        <button
          v-else
          type="button"
          class="bg-inverse text-inverse grid size-6 place-items-center rounded-md transition-all"
          :class="!message.trim() && !attachments.length || disabled ? 'opacity-20 scale-90' : 'hover:opacity-80'"
          @click="handleSend"
        >
          <ArrowUpIcon class="size-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
