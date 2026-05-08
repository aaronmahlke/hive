<script setup lang="ts">
import { XMarkIcon, ChevronDownIcon } from "@heroicons/vue/16/solid";

type Props = {
  messages: string[];
};

type Emits = {
  remove: [index: number];
};

const { messages } = defineProps<Props>();
const emit = defineEmits<Emits>();
const collapsed = ref(false);
</script>

<template>
  <div v-if="messages.length" class="px-3 py-2.5">
    <button
      type="button"
      class="text-copy text-tertiary flex w-full items-center gap-1.5 py-0.5 text-xs font-medium hover:text-primary transition-colors"
      @click="collapsed = !collapsed"
    >
      <ChevronDownIcon class="size-3 transition-transform" :class="collapsed ? '-rotate-90' : ''" />
      Queued ({{ messages.length }})
    </button>
    <div v-if="!collapsed" class="mt-1.5 flex max-h-[200px] flex-col gap-1 overflow-y-auto">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="group/q flex items-start gap-2"
      >
        <p class="text-copy text-secondary min-w-0 flex-1 truncate py-0.5">
          {{ msg }}
        </p>
        <OButton
          variant="ghost"
          size="xs"
          :icon-left="XMarkIcon"
          class="shrink-0 opacity-0 group-hover/q:opacity-100"
          @click="emit('remove', i)"
        />
      </div>
    </div>
  </div>
</template>
