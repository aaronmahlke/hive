type RawMessage = {
  info: {
    role: "user" | "assistant";
    id: string;
    sessionID: string;
    parentID?: string;
    time?: { created: number };
    modelID?: string;
    providerID?: string;
    agent?: string;
    [key: string]: any;
  };
  parts: any[];
};

type Turn = {
  userMessage: RawMessage;
  assistantMessages: RawMessage[];
};

type Signal = {
  id: string;
  type: string;
  content: string;
  options?: string[] | null;
  resolved: boolean;
};

type ConnectionState = {
  port: number | null;
  sessionId: string | null;
  worktreeId: string | null;
  isWorking: boolean;
  pendingQuestions: Signal[];
  modelName: string;
  connected: boolean;
  initializing: boolean;
  error: string | null;
};

type ConnectionWs = {
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

function getOrCreateGlobal<T>(key: string, factory: () => T): T {
  if (import.meta.client) {
    const w = window as any;
    if (!w.__hive) w.__hive = {};
    if (!w.__hive[key]) w.__hive[key] = factory();
    return w.__hive[key];
  }
  return factory();
}

const state = getOrCreateGlobal("state", () => reactive<Record<string, ConnectionState>>({}));
const wsConnections = getOrCreateGlobal("wsConnections", () => ({} as Record<string, ConnectionWs>));

// Messages stored in shallowRef per connection to avoid deep reactivity overhead.
const connectionMessages = getOrCreateGlobal("connectionMessages", () => new Map<string, Ref<RawMessage[]>>());

function getMessages(key: string): Ref<RawMessage[]> {
  let msgs = connectionMessages.get(key);
  if (!msgs) {
    msgs = shallowRef<RawMessage[]>([]);
    connectionMessages.set(key, msgs);
  }
  return msgs;
}

function ensureState(key: string): ConnectionState {
  if (!state[key]) {
    state[key] = {
      port: null,
      sessionId: null,
      worktreeId: null,
      isWorking: false,
      pendingQuestions: [],
      modelName: "",
      connected: false,
      initializing: false,
      error: null,
    };
  }
  getMessages(key);
  return state[key];
}

function groupTurns(messages: RawMessage[]): Turn[] {
  const result: Turn[] = [];
  let currentTurn: Turn | null = null;

  for (const msg of messages) {
    if (msg.info.role === "user") {
      currentTurn = { userMessage: msg, assistantMessages: [] };
      result.push(currentTurn);
    } else if (msg.info.role === "assistant" && currentTurn) {
      currentTurn.assistantMessages.push(msg);
    }
  }

  return result;
}

// Memoized version that reuses Turn objects when the structure hasn't changed.
const prevTurnsMap = getOrCreateGlobal("prevTurnsMap", () => new Map<string, Turn[]>());

function groupTurnsStable(key: string, messages: RawMessage[]): Turn[] {
  const newTurns = groupTurns(messages);
  const prevTurns = prevTurnsMap.get(key) || [];

  const result = newTurns.map((turn, i) => {
    const prev = prevTurns[i];
    if (prev && prev.userMessage.info.id === turn.userMessage.info.id) {
      prev.assistantMessages = turn.assistantMessages;
      return prev;
    }
    return turn;
  });

  prevTurnsMap.set(key, result);
  return result;
}

function handleWsMessage(key: string, event: MessageEvent) {
  const s = ensureState(key);

  let msg: { type: string; data: any };
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }

  switch (msg.type) {
    case "messages": {
      const msgs = getMessages(key);
      msgs.value = msg.data as RawMessage[];
      for (let i = msgs.value.length - 1; i >= 0; i--) {
        if (msgs.value[i]?.info?.role === "assistant" && msgs.value[i]?.info?.modelID) {
          s.modelName = msgs.value[i].info.modelID;
          break;
        }
      }
      break;
    }

    case "message:updated": {
      const msgs = getMessages(key);
      const info = msg.data.info;
      if (!info?.id) break;

      const idx = msgs.value.findIndex((m: RawMessage) => m.info.id === info.id);
      if (idx >= 0) {
        msgs.value[idx] = { ...msgs.value[idx], info };
      } else {
        const optimisticIdx = msgs.value.findIndex(
          (m: RawMessage) => m.info.id.startsWith("optimistic-") && m.info.role === info.role,
        );
        if (optimisticIdx >= 0) {
          const optimisticParts = msgs.value[optimisticIdx].parts;
          msgs.value.splice(optimisticIdx, 1);
          msgs.value.push({ info, parts: optimisticParts });
        } else {
          msgs.value.push({ info, parts: [] });
        }
      }
      if (info.role === "assistant" && info.modelID) {
        s.modelName = info.modelID;
      }
      triggerRef(msgs);
      break;
    }

    case "message:part.updated": {
      const msgs = getMessages(key);
      const part = msg.data.part;
      if (!part?.messageID) break;

      const msgIdx = msgs.value.findIndex((m: RawMessage) => m.info.id === part.messageID);
      if (msgIdx >= 0) {
        const message = msgs.value[msgIdx];
        const partIdx = message.parts.findIndex((p: any) => p.id === part.id);
        if (partIdx >= 0) {
          message.parts[partIdx] = part;
        } else {
          message.parts = message.parts.filter((p: any) => p.id);
          message.parts.push(part);
        }
        triggerRef(msgs);
      }
      break;
    }

    case "message:part.delta": {
      const msgs = getMessages(key);
      const { sessionID, messageID, partID, field, delta } = msg.data;
      if (!messageID || !partID || !delta) break;

      const msgIdx = msgs.value.findIndex((m: RawMessage) => m.info.id === messageID);
      if (msgIdx >= 0) {
        const message = msgs.value[msgIdx];
        const partIdx = message.parts.findIndex((p: any) => p.id === partID);
        if (partIdx >= 0) {
          const part = message.parts[partIdx] as any;
          if (field && typeof part[field] === "string") {
            part[field] += delta;
          } else if (field) {
            part[field] = delta;
          }
        } else {
          message.parts.push({
            id: partID,
            messageID,
            sessionID,
            type: "text",
            [field || "text"]: delta,
          } as any);
        }
        triggerRef(msgs);
      }
      break;
    }

    case "message:removed": {
      const msgs = getMessages(key);
      const { messageID } = msg.data;
      if (!messageID) break;
      const idx = msgs.value.findIndex((m: RawMessage) => m.info.id === messageID);
      if (idx >= 0) {
        msgs.value.splice(idx, 1);
        triggerRef(msgs);
      }
      break;
    }

    case "message:part.removed": {
      const msgs = getMessages(key);
      const { messageID, partID } = msg.data;
      if (!messageID || !partID) break;
      const msgIdx = msgs.value.findIndex((m: RawMessage) => m.info.id === messageID);
      if (msgIdx >= 0) {
        const parts = msgs.value[msgIdx].parts;
        const partIdx = parts.findIndex((p: any) => p.id === partID);
        if (partIdx >= 0) {
          parts.splice(partIdx, 1);
          triggerRef(msgs);
        }
      }
      break;
    }

    case "status":
      s.isWorking = msg.data.type !== "idle";
      break;

    case "signal": {
      const idx = s.pendingQuestions.findIndex((q) => q.id === msg.data.id);
      if (idx >= 0) {
        s.pendingQuestions[idx] = msg.data;
      } else if (msg.data.type === "question" && !msg.data.resolved) {
        s.pendingQuestions.push(msg.data);
      }
      break;
    }

    case "signal.resolved":
      s.pendingQuestions = s.pendingQuestions.filter(
        (q) => q.id !== msg.data.signalId,
      );
      break;

    case "connected":
      s.connected = true;
      s.initializing = false;
      s.error = null;
      console.log(`[store] WS connected for ${key}`);
      break;

    case "error":
      console.error(`[store:${key}]`, msg.data.message);
      s.error = msg.data.message;
      break;
  }
}

function connectWs(key: string, projectId: string, sessionId: string, worktreeId?: string) {
  const s = ensureState(key);

  disconnectWs(key);

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({ projectId, sessionId });
  if (worktreeId) params.set("worktreeId", worktreeId);
  const url = `${protocol}//${window.location.host}/ws/project?${params.toString()}`;

  const ws = new WebSocket(url);
  wsConnections[key] = { ws, reconnectTimer: null };

  ws.onopen = () => {
    s.connected = true;
    s.error = null;
  };

  ws.onmessage = (event) => {
    handleWsMessage(key, event);
  };

  ws.onclose = () => {
    s.connected = false;
    const entry = wsConnections[key];
    if (state[key] && (!entry || !entry.reconnectTimer)) {
      const reconnectEntry = entry || { ws: null, reconnectTimer: null };
      wsConnections[key] = reconnectEntry;
      reconnectEntry.reconnectTimer = setTimeout(() => {
        if (state[key]) {
          reconnectEntry.reconnectTimer = null;
          connectWs(key, projectId, sessionId, worktreeId);
        }
      }, 3000);
    }
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

function disconnectWs(key: string) {
  const conn = wsConnections[key];
  if (conn) {
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    if (conn.ws) {
      conn.ws.onclose = null;
      conn.ws.close();
      conn.ws = null;
    }
  }
}

function wsSend(key: string, data: any) {
  const conn = wsConnections[key];
  if (conn?.ws?.readyState === WebSocket.OPEN) {
    conn.ws.send(JSON.stringify(data));
  }
}

export function useHiveStore() {
  async function activate(projectId: string) {
    const key = projectId;
    const s = ensureState(key);

    if (s.connected || s.initializing) return;

    if (s.port && s.sessionId) {
      console.log(`[activate] Reconnecting WS (port=${s.port}, session=${s.sessionId})`);
      connectWs(key, projectId, s.sessionId);
      return;
    }

    s.initializing = true;
    s.error = null;

    const t0 = performance.now();
    console.log(`[activate] Starting for ${projectId}...`);

    try {
      const startResult = await $fetch(`/api/projects/${projectId}/start`, {
        method: "POST",
      });
      s.port = (startResult as any).port;
      console.log(`[activate] POST /start done: ${Math.round(performance.now() - t0)}ms (port=${s.port})`);

      const t1 = performance.now();
      const sessResult = await $fetch(`/api/projects/${projectId}/session`, {
        method: "POST",
      });
      s.sessionId = (sessResult as any).sessionId;
      console.log(`[activate] POST /session done: ${Math.round(performance.now() - t1)}ms (sessionId=${s.sessionId})`);

      console.log(`[activate] Connecting WS... (total so far: ${Math.round(performance.now() - t0)}ms)`);
      connectWs(key, projectId, s.sessionId!);
    } catch (e: any) {
      s.initializing = false;
      s.error = e.message || "Failed to connect";
      console.error(`[activate] Failed after ${Math.round(performance.now() - t0)}ms:`, e);
    }
  }

  async function activateWorktree(opts: {
    projectId: string;
    worktreePath: string;
    branchName: string;
  }) {
    const key = `wt:${opts.worktreePath}`;
    const s = ensureState(key);

    if (s.connected || s.initializing) return;

    s.initializing = true;
    s.error = null;

    const t0 = performance.now();
    console.log(`[activateWorktree] Starting for ${opts.branchName}...`);

    try {
      const startResult = await $fetch("/api/worktrees/start", {
        method: "POST",
        body: {
          projectId: opts.projectId,
          worktreePath: opts.worktreePath,
          branchName: opts.branchName,
        },
      }) as { id: string; port: number; alreadyRunning: boolean };

      s.port = startResult.port;
      console.log(`[activateWorktree] Server ready on :${startResult.port} (already=${startResult.alreadyRunning}) ${Math.round(performance.now() - t0)}ms`);

      const sessResult = await $fetch("/api/sessions", {
        method: "POST",
        body: { worktreeId: startResult.id },
      }) as { sessionId?: string; opencodeSessionId?: string };

      s.sessionId = sessResult.opencodeSessionId || null;
      s.worktreeId = startResult.id;
      console.log(`[activateWorktree] Session: ${s.sessionId} (hive: ${sessResult.sessionId}) ${Math.round(performance.now() - t0)}ms`);

      if (!s.sessionId) {
        throw new Error("Failed to create OpenCode session for worktree");
      }

      connectWs(key, opts.projectId, s.sessionId, startResult.id);
    } catch (e: any) {
      s.initializing = false;
      s.error = e.message || "Failed to connect to worktree";
      console.error(`[activateWorktree] Failed for ${opts.branchName}:`, e);
    }
  }

  function deactivate(key: string) {
    disconnectWs(key);
    delete state[key];
    delete wsConnections[key];
    connectionMessages.delete(key);
    prevTurnsMap.delete(key);
  }

  function connection(key: string) {
    ensureState(key);

    const msgs = getMessages(key);

    return {
      state: computed(() => state[key]),
      messages: msgs,
      turns: computed(() => groupTurnsStable(key, msgs.value)),
      isWorking: computed(() => state[key]?.isWorking ?? false),
      connected: computed(() => state[key]?.connected ?? false),
      initializing: computed(() => state[key]?.initializing ?? false),
      modelName: computed(() => state[key]?.modelName ?? ""),
      pendingQuestions: computed(() => state[key]?.pendingQuestions ?? []),
      error: computed(() => state[key]?.error ?? null),
      port: computed(() => state[key]?.port ?? null),
      sessionId: computed(() => state[key]?.sessionId ?? null),
    };
  }

  function project(projectId: string) {
    return connection(projectId);
  }

  function sendPrompt(key: string, text: string, opts?: { agent?: string; model?: string }) {
    const s = ensureState(key);

    const msgs = getMessages(key);
    msgs.value = [
      ...msgs.value,
      {
        info: {
          role: "user",
          id: `optimistic-${Date.now()}`,
          sessionID: s.sessionId || "",
          time: { created: Date.now() },
        },
        parts: [{ type: "text", text }],
      },
    ];
    s.isWorking = true;

    wsSend(key, {
      type: "prompt",
      data: { message: text, ...opts },
    });
  }

  function abort(key: string) {
    wsSend(key, { type: "abort" });
  }

  function resolveSignal(key: string, signalId: string, answer: string) {
    wsSend(key, {
      type: "resolve_signal",
      data: { signalId, answer },
    });
    const s = state[key];
    if (s) {
      s.pendingQuestions = s.pendingQuestions.filter((q) => q.id !== signalId);
    }
  }

  return {
    activate,
    activateWorktree,
    deactivate,
    connection,
    project,
    sendPrompt,
    abort,
    resolveSignal,
  };
}
