/**
 * Shared selected model state per connection key.
 * Used by o-chat and the command palette to read/write the active model.
 * Format: "providerId/modelId" composite key.
 *
 * Also tracks recently used models (global, persisted in localStorage).
 */

const MAX_RECENT = 5;

type ModelState = Record<string, string>;

const modelState = reactive<ModelState>({});

const recentModels = useLocalStorage<string[]>("hive:recentModels", []);

function addRecent(key: string) {
  if (!key) return;
  const filtered = recentModels.value.filter((k) => k !== key);
  filtered.unshift(key);
  recentModels.value = filtered.slice(0, MAX_RECENT);
}

export function useSelectedModel(connectionKey: MaybeRef<string | null>) {
  const key = computed(() => unref(connectionKey));

  const selectedModelId = computed({
    get: () => (key.value ? modelState[key.value] ?? "" : ""),
    set: (val: string) => {
      if (!key.value) return;
      modelState[key.value] = val;
      addRecent(val);
    },
  });

  return { selectedModelId, recentModels: recentModels as Ref<string[]> };
}
