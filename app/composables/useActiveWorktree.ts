type ActiveWorktreeState = Record<string, string | null>;
type ActiveSessionState = Record<string, string | null>;

const worktreeState = reactive<ActiveWorktreeState>({});
const sessionState = reactive<ActiveSessionState>({});
let initialized = false;

function loadFromStorage() {
  if (initialized || !import.meta.client) return;
  initialized = true;
  try {
    const stored = localStorage.getItem("hive:activeWorktrees");
    if (stored) Object.assign(worktreeState, JSON.parse(stored));
  } catch {}
  try {
    const stored = localStorage.getItem("hive:activeSessions");
    if (stored) Object.assign(sessionState, JSON.parse(stored));
  } catch {}
}

function persistWorktrees() {
  if (!import.meta.client) return;
  try {
    localStorage.setItem("hive:activeWorktrees", JSON.stringify(toRaw(worktreeState)));
  } catch {}
}

function persistSessions() {
  if (!import.meta.client) return;
  try {
    localStorage.setItem("hive:activeSessions", JSON.stringify(toRaw(sessionState)));
  } catch {}
}

// Session state key: "projectId" for main, "projectId:worktreePath" for worktrees
function sessionKey(projectId: string, worktreePath: string | null): string {
  return worktreePath ? `${projectId}:${worktreePath}` : projectId;
}

export function useActiveWorktree(projectId: MaybeRef<string | null>) {
  loadFromStorage();

  const id = computed(() => unref(projectId));

  const activeWorktreePath = computed({
    get: () => (id.value ? worktreeState[id.value] ?? null : null),
    set: (val: string | null) => {
      if (!id.value) return;
      worktreeState[id.value] = val;
      persistWorktrees();
    },
  });

  const activeSessionId = computed({
    get: () => {
      if (!id.value) return null;
      const key = sessionKey(id.value, activeWorktreePath.value);
      return sessionState[key] ?? null;
    },
    set: (val: string | null) => {
      if (!id.value) return;
      const key = sessionKey(id.value, activeWorktreePath.value);
      sessionState[key] = val;
      persistSessions();
    },
  });

  function setActive(worktreePath: string | null) {
    activeWorktreePath.value = worktreePath;
  }

  function setActiveSession(ocSessionId: string | null) {
    activeSessionId.value = ocSessionId;
  }

  function isActive(worktreePath: string | null): boolean {
    return activeWorktreePath.value === worktreePath;
  }

  return {
    activeWorktreePath,
    activeSessionId,
    setActive,
    setActiveSession,
    isActive,
  };
}
