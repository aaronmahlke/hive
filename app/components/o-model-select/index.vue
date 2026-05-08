<script setup lang="ts">
import { ChevronDownIcon, CheckIcon } from "@heroicons/vue/16/solid";
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxTrigger,
  ComboboxInput,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxEmpty,
} from "reka-ui";

type Model = {
  key: string;
  id: string;
  name: string;
  providerId: string;
  providerName: string;
};

type Provider = {
  id: string;
  name: string;
  models: Record<string, { id: string; name: string }>;
};

type Props = {
  projectId: string;
  modelId?: string;
};

const { projectId, modelId = "" } = defineProps<Props>();

const emit = defineEmits<{
  "update:modelId": [id: string];
}>();

const { recentModels } = useSelectedModel(ref(null));

const open = ref(false);
const isClosing = ref(false);
const searchTerm = ref("");
const frozenSearchTerm = ref("");

// projectId prop may be a connection key (e.g. "wt:/path"), extract the real project ID from the route
const route = useRoute();
const resolvedProjectId = computed(() => (route.params.id as string) || projectId);

const { data: providersData } = useFetch(
  () => `/api/projects/${resolvedProjectId.value}/providers`,
  {
    default: () => ({ providers: [] as Provider[], defaults: {} as Record<string, string> }),
  },
);

const providers = computed(() => providersData.value.providers as Provider[]);

const allModels = computed(() => {
  const models: Model[] = [];
  for (const p of providers.value) {
    const modelMap = p.models;
    if (modelMap && typeof modelMap === "object") {
      for (const m of Object.values(modelMap)) {
        models.push({
          key: `${p.id}/${m.id}`,
          id: m.id,
          name: m.name,
          providerId: p.id,
          providerName: p.name,
        });
      }
    }
  }
  return models;
});

const selectedModel = computed(() => allModels.value.find((m) => m.key === modelId));

const filteredGroups = computed(() => {
  const term = isClosing.value ? frozenSearchTerm.value : searchTerm.value;
  const q = term.toLowerCase();
  const groups: { providerId: string; providerName: string; models: Model[] }[] = [];

  for (const p of providers.value) {
    const modelMap = p.models;
    if (!modelMap || typeof modelMap !== "object") continue;

    const providerMatch = q && (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));

    const pModels = Object.values(modelMap)
      .map((m) => ({
        key: `${p.id}/${m.id}`,
        id: m.id,
        name: m.name,
        providerId: p.id,
        providerName: p.name,
      }))
      .filter((m) => !q || providerMatch || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));

    if (pModels.length) {
      groups.push({ providerId: p.id, providerName: p.name, models: pModels });
    }
  }
  return groups;
});

const recentGroup = computed(() => {
  const term = isClosing.value ? frozenSearchTerm.value : searchTerm.value;
  if (term) return null; // hide recent when searching
  const models = recentModels.value
    .map((key) => allModels.value.find((m) => m.key === key))
    .filter(Boolean) as Model[];
  if (!models.length) return null;
  return { providerId: "_recent", providerName: "Recent", models };
});

const customFilterFunction = (items: any[]) => items;

function handleSelect(val: string) {
  frozenSearchTerm.value = searchTerm.value;
  if (val) emit("update:modelId", val);
}

watch(open, (v, old) => {
  if (old && !v) {
    isClosing.value = true;
    setTimeout(() => {
      isClosing.value = false;
      searchTerm.value = "";
    }, 300);
  }
});
</script>

<template>
  <ComboboxRoot
    :model-value="modelId"
    v-model:open="open"
    v-model:search-term="searchTerm"
    :filter-function="customFilterFunction"
    :ignore-filter="true"
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
    @update:model-value="handleSelect"
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger
        class="text-copy hover:bg-subtle flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors outline-none"
        :class="modelId ? 'text-secondary' : 'text-tertiary'"
      >
        <span class="truncate">{{ selectedModel?.name || modelId || "Model" }}</span>
        <span v-if="selectedModel?.providerName" class="text-tertiary shrink-0">{{ selectedModel.providerName }}</span>
        <ChevronDownIcon class="size-3 shrink-0 opacity-50" />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        :side-offset="4"
        position="popper"
        class="model-select-content bg-base-2 border-neutral data-[state=closed]:animate-fade-out z-50 w-64 overflow-hidden rounded-lg border shadow-lg"
      >
        <ComboboxViewport class="p-0.5">
          <ComboboxInput
            v-model="searchTerm"
            :display-value="() => ''"
            class="text-copy text-primary placeholder:text-tertiary border-neutral flex h-8 w-full border-b bg-transparent px-2.5 leading-none outline-none"
            placeholder="Search models..."
          />

          <ComboboxEmpty class="text-copy text-tertiary px-3 py-3 text-center">
            No models found
          </ComboboxEmpty>

          <div class="max-h-64 overflow-auto py-1">
            <ComboboxGroup v-if="recentGroup">
              <ComboboxLabel class="text-copy text-tertiary px-3 py-1 font-medium">
                {{ recentGroup.providerName }}
              </ComboboxLabel>
              <ComboboxItem
                v-for="model in recentGroup.models"
                :key="`recent:${model.key}`"
                :value="model.key"
                class="text-copy text-primary hover:bg-subtle data-[highlighted]:bg-subtle relative flex cursor-pointer items-center gap-2 px-3 py-1.5 outline-none"
              >
                <span class="flex min-w-0 flex-1 items-baseline gap-1.5">
                  <span class="truncate">{{ model.name }}</span>
                  <span class="text-tertiary shrink-0">{{ model.providerName }}</span>
                </span>
                <ComboboxItemIndicator class="shrink-0">
                  <CheckIcon class="size-3.5" />
                </ComboboxItemIndicator>
              </ComboboxItem>
            </ComboboxGroup>

            <template v-for="(group, gi) in filteredGroups" :key="group.providerId">
              <div v-if="gi > 0 || recentGroup" class="border-neutral mx-2 my-1 border-t" />
              <ComboboxGroup>
                <ComboboxLabel class="text-copy text-tertiary px-3 py-1 font-medium">
                  {{ group.providerName }}
                </ComboboxLabel>
                <ComboboxItem
                  v-for="model in group.models"
                  :key="model.key"
                  :value="model.key"
                  class="text-copy text-primary hover:bg-subtle data-[highlighted]:bg-subtle relative flex cursor-pointer items-center gap-2 px-3 py-1.5 outline-none"
                >
                  <span class="min-w-0 flex-1 truncate">{{ model.name }}</span>
                  <ComboboxItemIndicator class="shrink-0">
                    <CheckIcon class="size-3.5" />
                  </ComboboxItemIndicator>
                </ComboboxItem>
              </ComboboxGroup>
            </template>
          </div>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<style>
.model-select-content[data-state="open"] {
  animation-duration: 150ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.model-select-content[data-state="open"][data-side="top"] {
  animation-name: fade-in-from-bottom;
}

.model-select-content[data-state="open"][data-side="bottom"] {
  animation-name: fade-in-from-top;
}
</style>
