<script setup lang="ts">
type Props = {
  size?: "xs" | "sm" | "md";
};

const { size = "sm" } = defineProps<Props>();

const sizeClasses = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
};

const dotSizeClasses = {
  xs: "size-0.5",
  sm: "size-1",
  md: "size-1",
};

const gapClasses = {
  xs: "gap-[2px]",
  sm: "gap-[2px]",
  md: "gap-[3px]",
};
</script>

<template>
  <div
    class="o-loader grid grid-cols-3 grid-rows-3"
    :class="[sizeClasses[size], gapClasses[size]]"
  >
    <span
      v-for="i in 9"
      :key="i"
      class="rounded-full bg-current"
      :class="dotSizeClasses[size]"
      :style="{ animationDelay: `${(i - 1) * 80}ms` }"
    />
  </div>
</template>

<style>
.o-loader span {
  opacity: 0.2;
  animation: o-loader-pulse 1s ease-in-out infinite;
}

@keyframes o-loader-pulse {
  0%, 60%, 100% {
    opacity: 0.2;
    scale: 0.85;
  }
  30% {
    opacity: 1;
    scale: 1;
  }
}
</style>
