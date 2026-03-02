type ActiveWorktreeState = Record<string, string | null>;

const state = reactive<ActiveWorktreeState>({});
let initialized = false;

function loadFromStorage() {
  if (initialized || !import.meta.client) return;
  initialized = true;
  try {
    const stored = localStorage.getItem("hive:activeWorktrees");
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.assign(state, parsed);
    }
  } catch {}
}

function persist() {
  if (!import.meta.client) return;
  try {
    localStorage.setItem("hive:activeWorktrees", JSON.stringify(toRaw(state)));
  } catch {}
}

export function useActiveWorktree(projectId: MaybeRef<string | null>) {
  loadFromStorage();

  const id = computed(() => unref(projectId));

  const activeWorktreePath = computed({
    get: () => (id.value ? state[id.value] ?? null : null),
    set: (val: string | null) => {
      if (!id.value) return;
      state[id.value] = val;
      persist();
    },
  });

  function setActive(worktreePath: string | null) {
    activeWorktreePath.value = worktreePath;
  }

  function isActive(worktreePath: string | null): boolean {
    return activeWorktreePath.value === worktreePath;
  }

  return {
    activeWorktreePath,
    setActive,
    isActive,
  };
}
