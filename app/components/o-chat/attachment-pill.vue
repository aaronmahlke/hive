<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/16/solid";

type Props = {
  preview: string;
  name: string;
};

type Emits = {
  remove: [];
};

const { preview, name } = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div class="bg-surface-1 border-edge group/pill relative inline-flex items-center gap-1.5 rounded-lg border py-1 pr-1.5 pl-1">
    <img
      :src="preview"
      :alt="name"
      class="size-6 shrink-0 rounded object-cover"
    />
    <span class="text-copy text-secondary max-w-24 truncate">{{ name }}</span>
    <button
      type="button"
      class="text-tertiary hover:text-primary grid size-4 shrink-0 place-items-center rounded-full transition-colors"
      @click.stop="emit('remove')"
    >
      <XMarkIcon class="size-3" />
    </button>
  </div>
</template>
