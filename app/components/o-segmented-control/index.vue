<script setup lang="ts">
import { ToggleGroupRoot, ToggleGroupItem } from "reka-ui";

type Option = {
  value: string;
  label: string;
  icon?: Component;
};

type Props = {
  options: Option[];
  modelValue: string;
};

const { options } = defineProps<Props>();
const model = defineModel<string>();

const containerRef = ref<HTMLElement>();
const indicatorStyle = ref({ left: "0px", width: "0px", opacity: "0" });

function updateIndicator() {
  const el = containerRef.value;
  if (!el || !model.value) return;
  const activeEl = el.querySelector(`[data-state="on"]`) as HTMLElement;
  if (activeEl) {
    indicatorStyle.value = {
      left: `${activeEl.offsetLeft}px`,
      width: `${activeEl.offsetWidth}px`,
      opacity: "1",
    };
  }
}

watch(model, () => nextTick(updateIndicator));
onMounted(() => nextTick(updateIndicator));

if (import.meta.client) {
  useResizeObserver(containerRef, () => updateIndicator());
}
</script>

<template>
  <div ref="containerRef" class="relative flex h-7 items-center rounded-lg bg-subtle p-0.5">
    <ToggleGroupRoot
      v-model="model"
      type="single"
      class="flex items-center"
    >
      <!-- Sliding indicator -->
      <div
        class="absolute top-0.5 bottom-0.5 rounded-[6px] shadow-sm transition-all duration-200 ease-out"
        :class="model === 'build' ? 'bg-accent/10' : model === 'plan' ? 'bg-warn/10' : 'bg-subtle'"
        :style="indicatorStyle"
      />

      <ToggleGroupItem
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
        class="text-copy relative z-1 flex h-6 cursor-pointer items-center gap-1.5 rounded-[6px] px-2 outline-none transition-colors select-none"
        :class="model === opt.value
          ? opt.value === 'build' ? 'text-accent' : opt.value === 'plan' ? 'text-warn' : 'text-primary'
          : 'text-tertiary hover:text-secondary'"
      >
        <component v-if="opt.icon" :is="opt.icon" class="size-3.5" />
        <span>{{ opt.label }}</span>
      </ToggleGroupItem>
    </ToggleGroupRoot>
  </div>
</template>
