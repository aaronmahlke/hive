<script setup lang="ts">
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
} from "reka-ui";

type Props = {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

const { side = "bottom", align = "start", sideOffset = 4 } = defineProps<Props>();
const open = defineModel<boolean>();
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        class="o-popover-content bg-base-3 border-neutral data-[state=closed]:animate-fade-out z-50 min-w-[8rem] overflow-hidden rounded-lg border shadow-lg outline-none"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
.o-popover-content[data-state="open"] {
  animation-duration: 150ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.o-popover-content[data-state="open"][data-side="top"] {
  animation-name: fade-in-from-bottom;
}

.o-popover-content[data-state="open"][data-side="bottom"] {
  animation-name: fade-in-from-top;
}

.o-popover-content[data-state="open"][data-side="left"] {
  animation-name: fade-in-from-right;
}

.o-popover-content[data-state="open"][data-side="right"] {
  animation-name: fade-in-from-left;
}
</style>
