<script setup lang="ts">
</script>

<template>
  <div class="o-button-group border-neutral flex items-center overflow-hidden rounded-lg border">
    <slot />
  </div>
</template>

<style>
.o-button-group > * {
  border-radius: 0;
  border: none !important;
}

.o-button-group > * + * {
  border-left: 1px solid var(--border-color-neutral) !important;
}
</style>
