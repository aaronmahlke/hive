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
        class="bg-base-2 border-neutral z-50 min-w-[10rem] overflow-hidden rounded-lg border p-1 shadow-lg"
      >
        <ContextMenuItem
          class="text-copy text-primary data-[highlighted]:bg-subtle flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none"
          @select="emit('copy')"
        >
          <ClipboardIcon class="text-tertiary size-3.5" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem
          class="text-copy text-primary data-[highlighted]:bg-subtle flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none"
          @select="emit('fork')"
        >
          <ArrowPathRoundedSquareIcon class="text-tertiary size-3.5" />
          Fork
        </ContextMenuItem>
        <ContextMenuSeparator class="border-neutral mx-1 my-1 border-t" />
        <ContextMenuItem
          class="text-copy text-danger data-[highlighted]:bg-danger-subtle flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none"
          @select="emit('revert')"
        >
          <ArrowUturnLeftIcon class="size-3.5" />
          Revert
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
