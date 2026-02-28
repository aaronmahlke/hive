<script setup lang="ts">
const route = useRoute();
const reviewId = computed(() => route.params.id as string);
</script>

<template>
  <OReview :review-id="reviewId" />
</template>
