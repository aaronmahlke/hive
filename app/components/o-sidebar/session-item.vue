<script setup lang="ts">
import { ChatBubbleLeftIcon, XMarkIcon } from "@heroicons/vue/16/solid";

type Props = {
  title: string;
  active?: boolean;
};

type Emits = {
  click: [];
  delete: [e: Event];
};

const { title, active = false } = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <OHover
    full-width
    :active="active"
    class="cursor-pointer"
    @click="emit('click')"
  >
    <div class="flex w-full items-center justify-between py-1 pr-2 pl-8">
      <div class="flex min-w-0 items-center gap-2">
        <ChatBubbleLeftIcon class="text-tertiary size-3 shrink-0" />
        <span class="text-copy-sm truncate" :class="active ? 'text-primary' : 'text-secondary'">
          {{ title }}
        </span>
      </div>
      <button
        type="button"
        class="grid size-5 place-items-center rounded"
        title="Delete session"
        @click.stop="emit('delete', $event)"
      >
        <XMarkIcon class="text-tertiary hover:text-danger hidden size-3 group-hover/h:block" />
      </button>
    </div>
  </OHover>
</template>
