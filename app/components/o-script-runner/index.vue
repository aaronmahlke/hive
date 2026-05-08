<script setup lang="ts">
import {
  PlayIcon,
  StopIcon,
  ChevronDownIcon,
} from "@heroicons/vue/16/solid";

type Props = {
  projectId: string;
  worktreePath?: string | null;
};

const { projectId, worktreePath = null } = defineProps<Props>();

const open = ref(false);
const lastUsedScript = useLocalStorage(`hive:lastScript:${projectId}`, "dev");

const { data: scriptsData, refresh } = useFetch(
  () => `/api/projects/${projectId}/scripts`,
  {
    query: { worktreePath },
    watch: [() => worktreePath],
    default: () => ({ scripts: {}, pkgManager: "npm", active: null, activeCwd: null }),
  },
);

let poll: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  poll = setInterval(() => refresh(), 3000);
});
onUnmounted(() => {
  if (poll) clearInterval(poll);
});

const scripts = computed(() => Object.keys(scriptsData.value.scripts));
const activeScript = computed(() => scriptsData.value.active);
const isRunning = computed(() => !!activeScript.value);

const primaryScript = computed(() => {
  if (activeScript.value) return activeScript.value;
  if (lastUsedScript.value && scripts.value.includes(lastUsedScript.value)) return lastUsedScript.value;
  return scripts.value[0] || "dev";
});

async function runScript(script: string) {
  open.value = false;
  lastUsedScript.value = script;
  await $fetch(`/api/projects/${projectId}/scripts`, {
    method: "POST",
    body: { script, worktreePath },
  });
  await refresh();
}

async function stop() {
  open.value = false;
  await $fetch(`/api/projects/${projectId}/scripts`, {
    method: "POST",
    body: { stop: true },
  });
  await refresh();
}

function handlePrimaryClick() {
  if (isRunning.value) {
    stop();
  } else {
    runScript(primaryScript.value);
  }
}
</script>

<template>
  <OButtonGroup>
    <OButton
      variant="transparent"
      size="sm"
      :icon-left="isRunning ? StopIcon : PlayIcon"
      :class="isRunning ? 'text-success' : ''"
      @click="handlePrimaryClick"
    >
      <span class="font-mono">{{ primaryScript }}</span>
    </OButton>

    <OPopover v-model="open" side="bottom" align="end">
      <template #trigger>
        <OButton
          variant="transparent"
          size="sm"
          :icon-left="ChevronDownIcon"
        />
      </template>

      <div class="max-h-64 w-48 overflow-auto py-1">
        <button
          v-if="isRunning"
          type="button"
          class="text-copy text-danger hover:bg-subtle flex w-full items-center gap-2 px-3 py-1.5 text-left"
          @click="stop"
        >
          <StopIcon class="size-3 shrink-0" />
          Stop {{ activeScript }}
        </button>

        <div
          v-if="isRunning && scripts.length"
          class="border-neutral mx-2 my-1 border-t"
        />

        <button
          v-for="script in scripts"
          :key="script"
          type="button"
          class="text-copy hover:bg-subtle flex w-full items-center gap-2 px-3 py-1.5 text-left"
          :class="script === activeScript ? 'text-success' : 'text-primary'"
          @click="runScript(script)"
        >
          <PlayIcon class="text-tertiary size-3 shrink-0" />
          <span class="truncate font-mono">{{ script }}</span>
        </button>

        <div
          v-if="!scripts.length"
          class="text-copy text-tertiary px-3 py-2 text-center"
        >
          No scripts found
        </div>
      </div>
    </OPopover>
  </OButtonGroup>
</template>
