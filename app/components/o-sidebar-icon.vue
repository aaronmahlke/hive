<script setup lang="ts">
type Props = {
  collapsed?: boolean;
  side?: "left" | "right";
};

const { collapsed = false, side = "left" } = defineProps<Props>();

const cutoutX = computed(() => side === "left" ? 2.5 : 10);
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="none"
    class="size-4"
  >
    <rect
      x="1.5"
      y="2.5"
      width="13"
      height="11"
      rx="2"
      fill="currentColor"
    />
    <rect
      :x="cutoutX"
      y="3.5"
      width="3.5"
      height="9"
      rx="1"
      fill="var(--color-base-0)"
      class="transition-all duration-200 ease-out"
      :style="{
        width: collapsed ? '1.5px' : '3.5px',
        x: collapsed && side === 'right' ? '12.5px' : cutoutX + 'px',
      }"
    />
  </svg>
</template>
