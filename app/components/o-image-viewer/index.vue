<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/16/solid";

type Props = {
  src: string;
};

type Emits = {
  close: [];
};

const { src } = defineProps<Props>();
const emit = defineEmits<Emits>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <button
        type="button"
        class="absolute top-4 right-4 grid size-8 place-items-center rounded-md text-white/60 transition-colors hover:text-white hover:bg-white/10"
        @click="emit('close')"
      >
        <XMarkIcon class="size-4" />
      </button>
      <img
        :src="src"
        class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
      />
    </div>
  </Teleport>
</template>
