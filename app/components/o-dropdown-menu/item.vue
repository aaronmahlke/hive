<script setup lang="ts">
import { DropdownMenuItem } from "reka-ui";

type Props = {
  variant?: "default" | "danger";
  icon?: Component;
  disabled?: boolean;
};

const { variant = "default", icon, disabled = false } = defineProps<Props>();
</script>

<template>
  <DropdownMenuItem
    :disabled
    class="group/item relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-copy outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    :class="variant === 'danger' ? 'text-danger' : 'text-primary'"
  >
    <div
      class="absolute inset-0 rounded-[inherit] bg-subtle opacity-0 transition-[inset] duration-150 group-data-[highlighted]/item:opacity-100 group-active/item:inset-px"
      :class="variant === 'danger' ? 'bg-danger-subtle' : ''"
    />
    <component
      v-if="icon"
      :is="icon"
      class="relative z-1 size-3.5 shrink-0"
      :class="variant === 'danger' ? '' : 'text-tertiary group-data-[highlighted]/item:text-primary'"
    />
    <span class="relative z-1">
      <slot />
    </span>
  </DropdownMenuItem>
</template>
