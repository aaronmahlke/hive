<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
} from "reka-ui";

type Props = {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

const { side = "bottom", align = "end", sideOffset = 4 } = defineProps<Props>();
const open = defineModel<boolean>();
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :side
        :align
        :side-offset="sideOffset"
        class="o-dropdown-menu-content bg-base-3 border-neutral data-[state=closed]:animate-fade-out z-50 min-w-[10rem] overflow-hidden rounded-lg border p-1 shadow-lg"
      >
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style>
.o-dropdown-menu-content[data-state="open"] {
  animation-duration: 150ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.o-dropdown-menu-content[data-state="open"][data-side="top"] {
  animation-name: fade-in-from-bottom;
}

.o-dropdown-menu-content[data-state="open"][data-side="bottom"] {
  animation-name: fade-in-from-top;
}
</style>
