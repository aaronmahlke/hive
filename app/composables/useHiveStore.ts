export type RawMessage = {
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

type PermissionRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, any>;
  always: string[];
  tool?: { messageID: string; callID: string };
};

type QuestionOption = {
  label: string;
  description: string;
};

type QuestionInfo = {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: { messageID: string; callID: string };
};

type AnsweredQuestion = {
  id: string;
  questions: { question: string; header: string }[];
  answers: string[][];
  toolCallID?: string;
};

type ConnectionState = {
  port: number | null;
  sessionId: string | null;
  worktreeId: string | null;
  isWorking: boolean;
  pendingQuestions: Signal[];
  pendingPermissions: PermissionRequest[];
  pendingOcQuestions: QuestionRequest[];
  answeredQuestions: AnsweredQuestion[];
  modelName: string;
  connected: boolean;
  initializing: boolean;
  error: string | null;
  /** Status per session ID — tracks working state of child sessions */
  sessionStatus: Record<string, { type: string }>;
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

// Child session messages — keyed by "connectionKey:sessionId"
const childSessionMessages = getOrCreateGlobal("childSessionMessages", () => new Map<string, Ref<RawMessage[]>>());

function getMessages(key: string): Ref<RawMessage[]> {
  let msgs = connectionMessages.get(key);
  if (!msgs) {
    msgs = shallowRef<RawMessage[]>([]);
    connectionMessages.set(key, msgs);
  }
  return msgs;
}

function getChildMessages(connectionKey: string, sessionId: string): Ref<RawMessage[]> {
  const key = `${connectionKey}:child:${sessionId}`;
  let msgs = childSessionMessages.get(key);
  if (!msgs) {
    msgs = shallowRef<RawMessage[]>([]);
    childSessionMessages.set(key, msgs);
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
      pendingPermissions: [],
      pendingOcQuestions: [],
      answeredQuestions: [],
      modelName: "",
      connected: false,
      initializing: false,
      error: null,
      sessionStatus: {},
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

/**
 * Determines if a message event belongs to the active session.
 * Returns the session ID from the event data.
 */
function getEventSessionId(data: any): string | undefined {
  return data?.sessionID || data?.info?.sessionID;
}

/**
 * Apply a message event to the correct message store (active or child session).
 * Returns the Ref<RawMessage[]> that was modified, or null if not applicable.
 */
function resolveMessageStore(key: string, eventSessionId: string | undefined): Ref<RawMessage[]> | null {
  const s = state[key];
  if (!s) return null;

  if (!eventSessionId || eventSessionId === s.sessionId) {
    return getMessages(key);
  }

  // It's a child session message
  return getChildMessages(key, eventSessionId);
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
      // Full message list for active session (on connect / switch)
      const msgs = getMessages(key);
      msgs.value = msg.data as RawMessage[];
      for (let i = msgs.value.length - 1; i >= 0; i--) {
        const info = msgs.value[i]?.info;
        if (info?.role === "assistant" && info?.modelID) {
          s.modelName = info.providerID ? `${info.providerID}/${info.modelID}` : info.modelID;
          break;
        }
      }
      break;
    }

    case "session:messages": {
      // Full message list for a child session (on demand fetch)
      const { sessionId: childSessionId, messages } = msg.data;
      if (!childSessionId || !Array.isArray(messages)) break;
      const childMsgs = getChildMessages(key, childSessionId);
      childMsgs.value = messages;
      break;
    }

    case "message:updated": {
      const eventSessionId = getEventSessionId(msg.data);
      const msgs = resolveMessageStore(key, eventSessionId);
      if (!msgs) break;

      const info = msg.data.info;
      if (!info?.id) break;

      const idx = msgs.value.findIndex((m: RawMessage) => m.info.id === info.id);
      if (idx >= 0) {
        msgs.value[idx] = { ...msgs.value[idx], info };
      } else {
        // Check for optimistic message (only in active session)
        if (!eventSessionId || eventSessionId === s.sessionId) {
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
        } else {
          msgs.value.push({ info, parts: [] });
        }
      }
      if (info.role === "assistant" && info.modelID && (!eventSessionId || eventSessionId === s.sessionId)) {
        s.modelName = info.providerID ? `${info.providerID}/${info.modelID}` : info.modelID;
      }
      triggerRef(msgs);
      break;
    }

    case "message:part.updated": {
      const eventSessionId = getEventSessionId(msg.data);
      const msgs = resolveMessageStore(key, eventSessionId);
      if (!msgs) break;

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
      const eventSessionId = msg.data?.sessionID;
      const msgs = resolveMessageStore(key, eventSessionId);
      if (!msgs) break;

      const { messageID, partID, field, delta } = msg.data;
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
            sessionID: eventSessionId,
            type: "text",
            [field || "text"]: delta,
          } as any);
        }
        triggerRef(msgs);
      }
      break;
    }

    case "message:removed": {
      const eventSessionId = getEventSessionId(msg.data);
      const msgs = resolveMessageStore(key, eventSessionId);
      if (!msgs) break;

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
      const eventSessionId = getEventSessionId(msg.data);
      const msgs = resolveMessageStore(key, eventSessionId);
      if (!msgs) break;

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

    case "status": {
      const eventSessionId = msg.data.sessionID;
      const isIdle = msg.data.type === "idle";

      // Track per-session status
      if (eventSessionId) {
        s.sessionStatus[eventSessionId] = msg.data;
      }

      // Update main isWorking for the active session
      if (!eventSessionId || eventSessionId === s.sessionId) {
        s.isWorking = !isIdle;
      }
      break;
    }

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

    // Permissions and questions are global (all sessions)
    case "permission:asked":
      s.pendingPermissions = [...s.pendingPermissions.filter((p) => p.id !== msg.data.id), msg.data];
      break;

    case "permission:replied":
      s.pendingPermissions = s.pendingPermissions.filter((p) => p.id !== msg.data.requestID);
      break;

    case "question:asked":
      s.pendingOcQuestions = [...s.pendingOcQuestions.filter((q) => q.id !== msg.data.id), msg.data];
      break;

    case "question:resolved":
      s.pendingOcQuestions = s.pendingOcQuestions.filter((q) => q.id !== msg.data.requestID);
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
  async function activate(projectId: string, preferredSessionId?: string | null) {
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
      // 1. Start the OpenCode server
      const startResult = await $fetch(`/api/projects/${projectId}/start`, {
        method: "POST",
      });
      s.port = (startResult as any).port;
      console.log(`[activate] POST /start done: ${Math.round(performance.now() - t0)}ms (port=${s.port})`);

      // 2. Resolve session: preferred > most recent existing > create new
      let sessionId = preferredSessionId || null;

      if (!sessionId) {
        const t1 = performance.now();
        const sessions = await $fetch(`/api/projects/${projectId}/sessions`) as any[];
        console.log(`[activate] Fetched ${sessions.length} sessions: ${Math.round(performance.now() - t1)}ms`);
        if (sessions.length > 0) {
          sessionId = sessions[0].id; // sorted by most recent
        }
      }

      if (!sessionId) {
        const t2 = performance.now();
        const newSess = await $fetch(`/api/projects/${projectId}/sessions`, { method: "POST" }) as any;
        sessionId = newSess.sessionId;
        console.log(`[activate] Created new session ${sessionId}: ${Math.round(performance.now() - t2)}ms`);
      }

      s.sessionId = sessionId;
      console.log(`[activate] Using session ${sessionId}, connecting WS... (total: ${Math.round(performance.now() - t0)}ms)`);
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
      s.worktreeId = startResult.id;

      const sessResult = await $fetch("/api/sessions", {
        method: "POST",
        body: { worktreeId: startResult.id },
      }) as { sessionId?: string; opencodeSessionId?: string };

      s.sessionId = sessResult.opencodeSessionId || null;

      if (!s.sessionId) {
        throw new Error("Failed to get OpenCode session for worktree");
      }

      connectWs(key, opts.projectId, s.sessionId, startResult.id);
    } catch (e: any) {
      s.initializing = false;
      s.error = e.message || "Failed to connect to worktree";
    }
  }

  function switchSession(key: string, opencodeSessionId: string) {
    const s = ensureState(key);

    // Clear local state for the new session
    const msgs = getMessages(key);
    msgs.value = [];
    prevTurnsMap.delete(key);

    s.sessionId = opencodeSessionId;
    s.isWorking = false;
    s.pendingQuestions = [];
    s.pendingPermissions = [];
    s.pendingOcQuestions = [];
    s.answeredQuestions = [];

    // Tell the server to switch — no disconnect needed
    wsSend(key, {
      type: "switch_session",
      data: { sessionId: opencodeSessionId },
    });
  }

  function deactivate(key: string) {
    disconnectWs(key);
    delete state[key];
    delete wsConnections[key];
    connectionMessages.delete(key);
    prevTurnsMap.delete(key);
    // Clean up child session messages
    for (const k of childSessionMessages.keys()) {
      if (k.startsWith(`${key}:child:`)) {
        childSessionMessages.delete(k);
      }
    }
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
      pendingPermissions: computed(() => state[key]?.pendingPermissions ?? []),
      pendingOcQuestions: computed(() => state[key]?.pendingOcQuestions ?? []),
      answeredQuestions: computed(() => state[key]?.answeredQuestions ?? []),
      error: computed(() => state[key]?.error ?? null),
      port: computed(() => state[key]?.port ?? null),
      sessionId: computed(() => state[key]?.sessionId ?? null),
      sessionStatus: computed(() => state[key]?.sessionStatus ?? {}),
    };
  }

  function project(projectId: string) {
    return connection(projectId);
  }

  function sendPrompt(key: string, text: string, opts?: { agent?: string; model?: string; attachments?: { type: "file"; mime: string; url: string; filename: string }[]; sessionId?: string }) {
    const s = ensureState(key);

    const parts: any[] = [];
    if (text) parts.push({ type: "text", text });
    if (opts?.attachments) {
      for (const att of opts.attachments) {
        parts.push({ type: "file", mime: att.mime, url: att.url, filename: att.filename });
      }
    }

    const targetSessionId = opts?.sessionId || s.sessionId;

    const msgs = getMessages(key);
    msgs.value = [
      ...msgs.value,
      {
        info: {
          role: "user",
          id: `optimistic-${Date.now()}`,
          sessionID: targetSessionId || "",
          time: { created: Date.now() },
        },
        parts,
      },
    ];
    s.isWorking = true;

    wsSend(key, {
      type: "prompt",
      data: {
        message: text,
        attachments: opts?.attachments,
        sessionId: opts?.sessionId,
        ...(opts?.agent && { agent: opts.agent }),
        ...(opts?.model && { model: opts.model }),
      },
    });
  }

  function abort(key: string, sessionId?: string) {
    wsSend(key, { type: "abort", data: { sessionId } });
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

  function replyPermission(key: string, requestId: string, reply: "once" | "always" | "reject", sessionId?: string) {
    wsSend(key, {
      type: "reply_permission",
      data: { requestId, reply, sessionId },
    });
    const s = state[key];
    if (s) {
      s.pendingPermissions = s.pendingPermissions.filter((p) => p.id !== requestId);
    }
  }

  function replyQuestion(key: string, requestId: string, answers: string[][]) {
    wsSend(key, {
      type: "reply_question",
      data: { requestId, answers },
    });
    const s = state[key];
    if (s) {
      const question = s.pendingOcQuestions.find((q) => q.id === requestId);
      if (question) {
        s.answeredQuestions.push({
          id: question.id,
          questions: question.questions.map((q) => ({ question: q.question, header: q.header })),
          answers,
          toolCallID: question.tool?.callID,
        });
      }
      s.pendingOcQuestions = s.pendingOcQuestions.filter((q) => q.id !== requestId);
    }
  }

  function rejectQuestion(key: string, requestId: string) {
    wsSend(key, {
      type: "reject_question",
      data: { requestId },
    });
    const s = state[key];
    if (s) {
      s.pendingOcQuestions = s.pendingOcQuestions.filter((q) => q.id !== requestId);
    }
  }

  /** Fetch messages for a child/sub-agent session */
  function fetchSessionMessages(key: string, sessionId: string) {
    wsSend(key, {
      type: "fetch_session_messages",
      data: { sessionId },
    });
  }

  /** Get child session messages (reactive) */
  function childMessages(key: string, sessionId: string): Ref<RawMessage[]> {
    return getChildMessages(key, sessionId);
  }

  /** Check if a specific session is working */
  function isSessionWorking(key: string, sessionId: string): boolean {
    const s = state[key];
    if (!s) return false;
    const status = s.sessionStatus[sessionId];
    return status ? status.type !== "idle" : false;
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
    replyPermission,
    replyQuestion,
    rejectQuestion,
    switchSession,
    fetchSessionMessages,
    childMessages,
    isSessionWorking,
  };
}
