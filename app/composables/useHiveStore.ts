/**
 * Global Hive store.
 *
 * Manages all project connections, sessions, messages, and status.
 * WebSocket connections persist across tab switches - they're only
 * torn down when a project tab is explicitly closed.
 *
 * Usage:
 *   const store = useHiveStore()
 *   store.activate(projectId)              // start server + connect WS
 *   const project = store.project(id)      // reactive project state
 *   store.sendPrompt(id, "hello")          // send through WS
 *   store.abort(id)                        // abort through WS
 *   store.deactivate(id)                   // close WS, cleanup
 */

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

type ProjectState = {
  port: number | null;
  sessionId: string | null;
  isWorking: boolean;
  pendingQuestions: Signal[];
  modelName: string;
  connected: boolean;
  initializing: boolean;
  error: string | null;
};

type ProjectConnections = {
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

// Singleton state - survives across component mounts/unmounts
const state = reactive<Record<string, ProjectState>>({});
const connections: Record<string, ProjectConnections> = {};

// Messages stored in shallowRef per project to avoid deep reactivity overhead.
// Vue only tracks the ref itself, not the (potentially huge) nested message objects.
const projectMessages = new Map<string, ShallowRef<RawMessage[]>>();

function getMessages(projectId: string): ShallowRef<RawMessage[]> {
  let msgs = projectMessages.get(projectId);
  if (!msgs) {
    msgs = shallowRef<RawMessage[]>([]);
    projectMessages.set(projectId, msgs);
  }
  return msgs;
}

function ensureState(projectId: string): ProjectState {
  if (!state[projectId]) {
    state[projectId] = {
      port: null,
      sessionId: null,
      isWorking: false,
      pendingQuestions: [],
      modelName: "",
      connected: false,
      initializing: false,
      error: null,
    };
  }
  // Ensure messages ref exists too
  getMessages(projectId);
  return state[projectId];
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

function handleWsMessage(projectId: string, event: MessageEvent) {
  const s = ensureState(projectId);

  let msg: { type: string; data: any };
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }

  switch (msg.type) {
    case "messages": {
      const msgs = getMessages(projectId);
      const jsonSize = JSON.stringify(msg.data).length;
      console.log(`[ws] Messages received: ${msg.data.length} messages, ${Math.round(jsonSize / 1024)}KB`);
      msgs.value = msg.data;
      // Extract model name from latest assistant message
      for (let i = msg.data.length - 1; i >= 0; i--) {
        if (msg.data[i]?.info?.role === "assistant" && msg.data[i]?.info?.modelID) {
          s.modelName = msg.data[i].info.modelID;
          break;
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
      console.log(`[activate] WS connected for ${projectId}`);
      break;

    case "error":
      console.error(`[hive:store:${projectId}]`, msg.data.message);
      s.error = msg.data.message;
      break;
  }
}

function connectWs(projectId: string) {
  const s = ensureState(projectId);

  if (!s.sessionId || !s.port) return;

  // Clean up existing connection
  disconnectWs(projectId);

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws/project?projectId=${projectId}&sessionId=${s.sessionId}`;

  const ws = new WebSocket(url);
  connections[projectId] = { ws, reconnectTimer: null };

  ws.onopen = () => {
    s.connected = true;
    s.error = null;
  };

  ws.onmessage = (event) => {
    handleWsMessage(projectId, event);
  };

  ws.onclose = () => {
    s.connected = false;
    // Auto-reconnect after 3 seconds if the project is still in state
    if (state[projectId] && !connections[projectId]?.reconnectTimer) {
      connections[projectId] = connections[projectId] || { ws: null, reconnectTimer: null };
      connections[projectId].reconnectTimer = setTimeout(() => {
        if (state[projectId]) {
          connections[projectId].reconnectTimer = null;
          connectWs(projectId);
        }
      }, 3000);
    }
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

function disconnectWs(projectId: string) {
  const conn = connections[projectId];
  if (conn) {
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    if (conn.ws) {
      conn.ws.onclose = null; // prevent reconnect
      conn.ws.close();
      conn.ws = null;
    }
  }
}

function wsSend(projectId: string, data: any) {
  const conn = connections[projectId];
  if (conn?.ws?.readyState === WebSocket.OPEN) {
    conn.ws.send(JSON.stringify(data));
  }
}

export function useHiveStore() {
  /**
   * Initialize a project: start OpenCode server, get session, connect WebSocket.
   * Safe to call multiple times - skips if already initialized.
   */
  async function activate(projectId: string) {
    const s = ensureState(projectId);

    // Already connected or initializing
    if (s.connected || s.initializing) return;

    // Already have port + session, just reconnect WS
    if (s.port && s.sessionId) {
      console.log(`[activate] Reconnecting WS (port=${s.port}, session=${s.sessionId})`);
      connectWs(projectId);
      return;
    }

    s.initializing = true;
    s.error = null;

    const t0 = performance.now();
    console.log(`[activate] Starting for ${projectId}...`);

    try {
      // Start OpenCode server (waits for health internally)
      const startResult = await $fetch(`/api/projects/${projectId}/start`, {
        method: "POST",
      });
      s.port = (startResult as any).port;
      console.log(`[activate] POST /start done: ${Math.round(performance.now() - t0)}ms (port=${s.port}, alreadyRunning=${(startResult as any).alreadyRunning})`);

      // Get or create session
      const t1 = performance.now();
      const sessResult = await $fetch(`/api/projects/${projectId}/session`, {
        method: "POST",
      });
      s.sessionId = (sessResult as any).sessionId;
      console.log(`[activate] POST /session done: ${Math.round(performance.now() - t1)}ms (sessionId=${s.sessionId}, reconnected=${(sessResult as any).reconnected})`);

      // Connect WebSocket
      console.log(`[activate] Connecting WS... (total so far: ${Math.round(performance.now() - t0)}ms)`);
      connectWs(projectId);
    } catch (e: any) {
      s.initializing = false;
      s.error = e.message || "Failed to connect";
      console.error(`[activate] Failed after ${Math.round(performance.now() - t0)}ms:`, e);
    }
  }

  /**
   * Tear down a project's connections and state.
   */
  function deactivate(projectId: string) {
    disconnectWs(projectId);
    delete state[projectId];
    delete connections[projectId];
    projectMessages.delete(projectId);
  }

  /**
   * Get reactive state for a project.
   */
  function project(projectId: string) {
    ensureState(projectId);

    const msgs = getMessages(projectId);

    return {
      state: computed(() => state[projectId]),
      messages: msgs,
      turns: computed(() => groupTurns(msgs.value)),
      isWorking: computed(() => state[projectId]?.isWorking ?? false),
      connected: computed(() => state[projectId]?.connected ?? false),
      initializing: computed(() => state[projectId]?.initializing ?? false),
      modelName: computed(() => state[projectId]?.modelName ?? ""),
      pendingQuestions: computed(() => state[projectId]?.pendingQuestions ?? []),
      error: computed(() => state[projectId]?.error ?? null),
      port: computed(() => state[projectId]?.port ?? null),
      sessionId: computed(() => state[projectId]?.sessionId ?? null),
    };
  }

  /**
   * Send a prompt. If agent is busy, caller should handle queueing.
   */
  function sendPrompt(projectId: string, text: string, opts?: { agent?: string; model?: string }) {
    const s = ensureState(projectId);

    // Optimistic user message
    const msgs = getMessages(projectId);
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

    wsSend(projectId, {
      type: "prompt",
      data: { message: text, ...opts },
    });
  }

  function abort(projectId: string) {
    wsSend(projectId, { type: "abort" });
  }

  function resolveSignal(projectId: string, signalId: string, answer: string) {
    wsSend(projectId, {
      type: "resolve_signal",
      data: { signalId, answer },
    });
    // Optimistic removal
    const s = state[projectId];
    if (s) {
      s.pendingQuestions = s.pendingQuestions.filter((q) => q.id !== signalId);
    }
  }

  return {
    activate,
    deactivate,
    project,
    sendPrompt,
    abort,
    resolveSignal,
  };
}
