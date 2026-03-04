<script setup lang="ts">
import { PlusIcon, XMarkIcon, RectangleStackIcon } from "@heroicons/vue/16/solid";

const route = useRoute();
const router = useRouter();

const openTabs = useLocalStorage<string[]>("hive:openTabs", []);

const { data: allProjects, refresh: refreshProjects } = useFetch("/api/projects");

const tabProjects = computed(() => {
  if (!allProjects.value) return [];
  return openTabs.value
    .map((id) => allProjects.value!.find((p) => p.id === id))
    .filter(Boolean);
});

const currentProjectId = computed(() => {
  if (route.params.id) return route.params.id as string;
  return null;
});

const isHome = computed(() => route.path === "/" || route.path === "");

watch(currentProjectId, (id) => {
  if (id && !openTabs.value.includes(id)) {
    openTabs.value.push(id);
  }
}, { immediate: true });

async function openProject() {
  let selectedPath: string | null = null;

  if (window.electronAPI) {
    selectedPath = await window.electronAPI.openDirectory();
  } else {
    selectedPath = prompt("Enter the project path:");
  }

  if (!selectedPath) return;

  const project = await $fetch("/api/projects", {
    method: "POST",
    body: { path: selectedPath },
  });

  if (!openTabs.value.includes(project.id)) {
    openTabs.value.push(project.id);
  }

  router.push(`/project/${project.id}`);

  // Refresh project list in background (non-blocking)
  refreshProjects();
}

const store = useHiveStore();

function closeTab(projectId: string, e: Event) {
  e.preventDefault();
  e.stopPropagation();

  store.deactivate(projectId);

  openTabs.value = openTabs.value.filter((id) => id !== projectId);

  if (currentProjectId.value === projectId) {
    if (openTabs.value.length) {
      router.push(`/project/${openTabs.value[openTabs.value.length - 1]}`);
    } else {
      router.push("/");
    }
  }
}

function switchToNext() {
  if (!openTabs.value.length) return;
  const idx = currentProjectId.value ? openTabs.value.indexOf(currentProjectId.value) : -1;
  const nextIdx = idx === -1 || idx >= openTabs.value.length - 1 ? 0 : idx + 1;
  router.push(`/project/${openTabs.value[nextIdx]}`);
}

function switchToPrev() {
  if (!openTabs.value.length) return;
  const idx = currentProjectId.value ? openTabs.value.indexOf(currentProjectId.value) : -1;
  const prevIdx = idx <= 0 ? openTabs.value.length - 1 : idx - 1;
  router.push(`/project/${openTabs.value[prevIdx]}`);
}

onKeyStroke("ArrowRight", (e) => {
  if (!e.metaKey || !e.altKey) return;
  e.preventDefault();
  switchToNext();
});

onKeyStroke("ArrowLeft", (e) => {
  if (!e.metaKey || !e.altKey) return;
  e.preventDefault();
  switchToPrev();
});

onKeyStroke("Tab", (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  if (e.shiftKey) switchToPrev();
  else switchToNext();
});

const { containerRef: tabListRef, draggingIndex } = useDragReorder(openTabs);
</script>

<template>
  <div class="flex items-center gap-0.5">
    <OHover :active="isHome" class="cursor-default">
      <NuxtLink
        to="/"
        class="grid size-6 place-items-center outline-none"
        :class="isHome ? 'text-primary' : 'text-tertiary'"
      >
        <RectangleStackIcon class="size-3.5" />
      </NuxtLink>
    </OHover>

    <div ref="tabListRef" class="flex items-center gap-0.5">
      <OTooltip
        v-for="(proj, i) in tabProjects"
        :key="proj!.id"
        :content="proj!.name"
        side="bottom"
      >
        <OHover
          :active="currentProjectId === proj!.id"
          class="cursor-default"
          :class="draggingIndex === i ? 'opacity-80' : ''"
        >
          <div class="flex items-center">
            <NuxtLink
              :to="`/project/${proj!.id}`"
              draggable="false"
              class="text-copy-sm max-w-32 truncate whitespace-nowrap py-1 pl-2.5 pr-1 outline-none select-none"
              :class="
                currentProjectId === proj!.id ? 'text-primary' : 'text-tertiary'
              "
            >
              {{ proj!.name }}
            </NuxtLink>
            <button
              type="button"
              class="text-tertiary hover:text-primary grid size-5 place-items-center rounded opacity-0 transition-opacity outline-none group-hover/h:opacity-100"
              :class="currentProjectId === proj!.id ? 'opacity-60' : ''"
              @click="closeTab(proj!.id, $event)"
            >
              <XMarkIcon class="size-3" />
            </button>
          </div>
        </OHover>
      </OTooltip>
    </div>

    <OHover class="cursor-default">
      <button
        type="button"
        class="text-tertiary hover:text-primary grid size-6 place-items-center outline-none"
        @click="openProject"
      >
        <PlusIcon class="size-3.5" />
      </button>
    </OHover>
  </div>
</template>
