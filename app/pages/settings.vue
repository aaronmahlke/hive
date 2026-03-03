<script setup lang="ts">
import { Cog6ToothIcon, PlusIcon } from "@heroicons/vue/16/solid";

const { data: profile, refresh } = await useFetch("/api/profile", {
  default: () => [],
});

const { data: projectList, refresh: refreshProjects } = await useFetch("/api/projects", {
  default: () => [],
});

const categories = ["style", "preference", "convention", "rule"] as const;

const newEntry = ref({
  key: "",
  value: "",
  category: "preference" as (typeof categories)[number],
});

const saving = ref(false);

async function addEntry() {
  if (!newEntry.value.key || !newEntry.value.value) return;

  saving.value = true;
  try {
    await $fetch("/api/profile", {
      method: "PUT",
      body: {
        entries: [
          {
            key: newEntry.value.key,
            value: newEntry.value.value,
            category: newEntry.value.category,
          },
        ],
      },
    });
    newEntry.value = { key: "", value: "", category: "preference" };
    await refresh();
  } finally {
    saving.value = false;
  }
}

const groupedProfile = computed(() => {
  const grouped: Record<string, typeof profile.value> = {};
  for (const entry of profile.value || []) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }
  return grouped;
});

const savingConfigPath = ref<Record<string, boolean>>({});

async function browseConfigPath(projectId: string) {
  let selectedPath: string | null = null;

  if (window.electronAPI) {
    selectedPath = await window.electronAPI.openFile({
      title: "Select OpenCode config file",
      filters: [
        { name: "JSON", extensions: ["json", "jsonc"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
  } else {
    selectedPath = prompt("Enter the config file path:");
  }

  if (!selectedPath) return;

  savingConfigPath.value[projectId] = true;
  try {
    await $fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: { opencodeConfigPath: selectedPath },
    });
    await refreshProjects();
  } finally {
    savingConfigPath.value[projectId] = false;
  }
}

async function clearConfigPath(projectId: string) {
  savingConfigPath.value[projectId] = true;
  try {
    await $fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: { opencodeConfigPath: null },
    });
    await refreshProjects();
  } finally {
    savingConfigPath.value[projectId] = false;
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <OHeader :icon="Cog6ToothIcon" title="Settings" description="Developer Profile & Preferences" />

    <div class="flex-1 overflow-auto p-6">
      <div class="mx-auto max-w-2xl">
        <h2 class="text-title-sm text-primary mb-4">Project Configs</h2>
        <p class="text-copy text-secondary mb-6">
          Set a custom OpenCode config file per project. All worktrees in a
          project inherit its config.
        </p>

        <div v-if="projectList?.length" class="mb-8 flex flex-col gap-2">
          <div
            v-for="proj in projectList"
            :key="proj.id"
            class="bg-surface-1 border-edge rounded-md border px-3 py-2"
          >
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <span class="text-copy text-primary font-medium">{{ proj.name }}</span>
                <span
                  v-if="proj.opencodeConfigPath"
                  class="text-copy-sm text-secondary ml-2 font-mono"
                >
                  {{ proj.opencodeConfigPath }}
                </span>
                <span v-else class="text-copy-sm text-tertiary ml-2">
                  Using global config
                </span>
              </div>
              <div class="flex items-center gap-1">
                <OButton
                  variant="transparent"
                  size="xs"
                  :loading="savingConfigPath[proj.id]"
                  @click="browseConfigPath(proj.id)"
                >
                  {{ proj.opencodeConfigPath ? 'Change' : 'Browse' }}
                </OButton>
                <OButton
                  v-if="proj.opencodeConfigPath"
                  variant="transparent"
                  size="xs"
                  :loading="savingConfigPath[proj.id]"
                  @click="clearConfigPath(proj.id)"
                >
                  Clear
                </OButton>
              </div>
            </div>
          </div>
        </div>
        <div
          v-else
          class="bg-surface-1 border-edge text-copy text-tertiary mb-8 rounded-lg border p-8 text-center"
        >
          No projects yet. Open a project first.
        </div>

        <h2 class="text-title-sm text-primary mb-4">Developer Profile</h2>
        <p class="text-copy text-secondary mb-6">
          These preferences are injected into agent prompts so they write code
          matching your style.
        </p>

        <div v-for="(entries, category) in groupedProfile" :key="category" class="mb-6">
          <h3 class="text-label text-primary mb-2 capitalize">{{ category }}</h3>
          <div class="flex flex-col gap-2">
            <div
              v-for="entry in entries"
              :key="entry.id"
              class="bg-surface-1 border-edge flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div>
                <span class="text-copy text-primary font-medium">{{ entry.key }}</span>
                <span class="text-copy text-tertiary mx-2">:</span>
                <span class="text-copy text-secondary">{{ entry.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="!profile?.length"
          class="bg-surface-1 border-edge text-copy text-tertiary rounded-lg border p-8 text-center"
        >
          No preferences configured yet. Add some below.
        </div>

        <div class="border-edge mt-6 border-t pt-6">
          <h3 class="text-label text-primary mb-3">Add Preference</h3>
          <form class="flex flex-col gap-3" @submit.prevent="addEntry">
            <div class="flex gap-2">
              <select
                v-model="newEntry.category"
                class="bg-surface-1 border-edge text-copy text-primary h-8 rounded-md border px-2"
              >
                <option v-for="cat in categories" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
              <OInput
                v-model="newEntry.key"
                placeholder="Key (e.g., naming)"
                class="flex-1"
              />
              <OInput
                v-model="newEntry.value"
                placeholder="Value (e.g., camelCase for functions)"
                class="flex-1"
              />
            </div>
            <div>
              <OButton
                type="submit"
                variant="primary"
                size="md"
                :icon-left="PlusIcon"
                :loading="saving"
                :disabled="!newEntry.key || !newEntry.value"
              >
                Add
              </OButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
