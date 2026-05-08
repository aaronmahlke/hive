<script setup lang="ts">
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "reka-ui";
import {
  ClipboardIcon,
  ArrowUturnLeftIcon,
  ArrowPathRoundedSquareIcon,
} from "@heroicons/vue/16/solid";

type Emits = {
  copy: [];
  revert: [];
  fork: [];
};

const emit = defineEmits<Emits>();
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="bg-base-3 border-neutral z-50 min-w-[10rem] overflow-hidden rounded-lg border p-1 shadow-lg"
      >
        <ContextMenuItem
          class="group/item relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-copy text-primary outline-none select-none"
          @select="emit('copy')"
        >
          <div class="absolute inset-0 rounded-[inherit] bg-subtle opacity-0 transition-[inset] duration-150 group-data-[highlighted]/item:opacity-100 group-active/item:inset-px" />
          <ClipboardIcon class="relative z-1 text-tertiary group-data-[highlighted]/item:text-primary size-3.5" />
          <span class="relative z-1">Copy</span>
        </ContextMenuItem>
        <ContextMenuItem
          class="group/item relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-copy text-primary outline-none select-none"
          @select="emit('fork')"
        >
          <div class="absolute inset-0 rounded-[inherit] bg-subtle opacity-0 transition-[inset] duration-150 group-data-[highlighted]/item:opacity-100 group-active/item:inset-px" />
          <ArrowPathRoundedSquareIcon class="relative z-1 text-tertiary group-data-[highlighted]/item:text-primary size-3.5" />
          <span class="relative z-1">Fork</span>
        </ContextMenuItem>
        <ContextMenuSeparator class="border-neutral my-1 border-t" />
        <ContextMenuItem
          class="group/item relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-copy text-danger outline-none select-none"
          @select="emit('revert')"
        >
          <div class="absolute inset-0 rounded-[inherit] bg-danger-subtle opacity-0 transition-[inset] duration-150 group-data-[highlighted]/item:opacity-100 group-active/item:inset-px" />
          <ArrowUturnLeftIcon class="relative z-1 size-3.5" />
          <span class="relative z-1">Revert</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
