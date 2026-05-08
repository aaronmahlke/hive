<script setup lang="ts">
import { Cog6ToothIcon } from "@heroicons/vue/16/solid";
import { TooltipProvider } from "reka-ui";

const { selectedFile } = useChanges();
const isDiffOpen = computed(() => !!selectedFile.value);

const { toggle: togglePalette } = useCommandPalette();
const { leftCollapsed, toggleLeft } = useSidebarState();

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    togglePalette();
  }
}

onMounted(() => document.addEventListener("keydown", onGlobalKeydown));
onUnmounted(() => document.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <TooltipProvider :delay-duration="400">
  <OCommandPalette />
  <div class="bg-base-0 flex h-screen flex-col overflow-hidden">
    <header class="flex h-10 shrink-0 items-center gap-1">
      <div class="w-20 shrink-0" />

      <OButton
        variant="ghost"
        size="sm"
        @click="toggleLeft"
      >
        <template #leading>
          <OSidebarIcon :collapsed="leftCollapsed" side="left" />
        </template>
      </OButton>

      <OTabs />

      <div
        class="flex-1 self-stretch"
        style="-webkit-app-region: drag"
      />

      <div class="flex shrink-0 items-center gap-1 pr-2">
        <OButton
          variant="ghost"
          size="sm"
          to="/settings"
          :icon-left="Cog6ToothIcon"
        />
      </div>
    </header>

    <div class="flex min-h-0 flex-1 gap-1 px-1 pb-1">
      <aside
        v-show="!isDiffOpen"
        class="shrink-0 transition-[width] duration-200 ease-out"
        :class="leftCollapsed ? 'w-0 overflow-hidden' : 'w-60'"
      >
        <OSidebar />
      </aside>

      <main
        class="bg-base-1 relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-neutral"
      >
        <slot />
      </main>
    </div>
  </div>
  </TooltipProvider>
</template>
