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

    <ODropdownMenu v-model="open" side="bottom" align="end">
      <template #trigger>
        <OButton
          variant="transparent"
          size="sm"
          :icon-left="ChevronDownIcon"
        />
      </template>

      <ODropdownMenuItem
        v-if="isRunning"
        variant="danger"
        :icon="StopIcon"
        @click="stop"
      >
        Stop {{ activeScript }}
      </ODropdownMenuItem>

      <ODropdownMenuSeparator v-if="isRunning && scripts.length" />

      <ODropdownMenuItem
        v-for="script in scripts"
        :key="script"
        :icon="PlayIcon"
        @click="runScript(script)"
      >
        <span class="font-mono" :class="script === activeScript ? 'text-success' : ''">{{ script }}</span>
      </ODropdownMenuItem>

      <div v-if="!scripts.length" class="text-copy text-tertiary px-2 py-3 text-center">
        No scripts found
      </div>
    </ODropdownMenu>
  </OButtonGroup>
</template>
