import type { Peer, Message } from "crossws";
import { db } from "../../database";
import { projects, signals, worktrees } from "../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../utils/parse-config";
import { getProjectEvents, emitProjectEvent, emitOnPort } from "../../services/opencode-events";

/**
 * WebSocket endpoint for real-time project communication.
 *
 * Forwards ALL events from the OpenCode SSE stream — no session filtering.
 * The client receives events for all sessions (parent + children) and decides
 * what to render. This enables sub-agent visibility: permissions, questions,
 * messages, and status from child sessions flow through naturally.
 *
 * Initial data (messages, status) is fetched for the "active" session on connect
 * and on switch_session. SSE events for all sessions stream continuously.
 */

const peerInfo = new Map<
  string,
  {
    projectId: string;
    sessionId: string;
    port: number;
  }
>();

export default defineWebSocketHandler({
  async open(peer: Peer) {
    const t0 = Date.now();
    const url = new URL(peer.request?.url || "", "http://localhost");
    const projectId = url.searchParams.get("projectId");
    const sessionId = url.searchParams.get("sessionId");
    const worktreeId = url.searchParams.get("worktreeId");

    if (!projectId || !sessionId) {
      peer.send(JSON.stringify({ type: "error", data: { message: "projectId and sessionId required" } }));
      peer.close(1008, "Missing parameters");
      return;
    }

    let port: number | null = null;

    if (worktreeId) {
      const worktree = await db.query.worktrees.findFirst({
        where: eq(worktrees.id, worktreeId),
      });
      port = worktree?.opencodePort ?? null;
      console.log(`[ws:open] Worktree lookup (${worktreeId}): port=${port} ${Date.now() - t0}ms`);
    } else {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      console.log(`[ws:open] Project lookup: ${Date.now() - t0}ms`);

      if (!project) {
        peer.send(JSON.stringify({ type: "error", data: { message: "Project not found" } }));
        peer.close(1008, "Project not found");
        return;
      }

      const config = parseConfig(project.configOverride);
      port = config.opencodePort ?? null;
    }

    if (!port) {
      peer.send(JSON.stringify({ type: "error", data: { message: "OpenCode server not running" } }));
      peer.close(1008, "No server");
      return;
    }

    peerInfo.set(peer.id, { projectId, sessionId, port });

    peer.send(JSON.stringify({
      type: "connected",
      data: { sessionId, port },
    }));
    console.log(`[ws:open] Sent connected event: ${Date.now() - t0}ms`);

    // Subscribe to OpenCode SSE events — forward ALL events unfiltered.
    // Each event includes its sessionID so the client can route them.
    const emitter = getProjectEvents(projectId, port);

    const handleEvent = (event: { type: string; properties: any }) => {
      try {
        const eventType = event.type;
        const eventSessionId = event.properties?.sessionID
          || event.properties?.info?.sessionID;

        if (eventType === "message.updated") {
          peer.send(JSON.stringify({ type: "message:updated", data: event.properties }));
        } else if (eventType === "message.part.updated") {
          peer.send(JSON.stringify({ type: "message:part.updated", data: event.properties }));
        } else if (eventType === "message.removed") {
          peer.send(JSON.stringify({ type: "message:removed", data: event.properties }));
        } else if (eventType === "message.part.delta") {
          peer.send(JSON.stringify({ type: "message:part.delta", data: event.properties }));
        } else if (eventType === "message.part.removed") {
          peer.send(JSON.stringify({ type: "message:part.removed", data: event.properties }));
        } else if (eventType === "session.status") {
          const status = event.properties?.status;
          if (status) {
            peer.send(JSON.stringify({ type: "status", data: { ...status, sessionID: eventSessionId } }));
          }
        } else if (eventType === "session.idle") {
          peer.send(JSON.stringify({ type: "status", data: { type: "idle", sessionID: eventSessionId } }));
        } else if (eventType === "permission.asked") {
          peer.send(JSON.stringify({ type: "permission:asked", data: event.properties }));
        } else if (eventType === "permission.replied") {
          peer.send(JSON.stringify({ type: "permission:replied", data: event.properties }));
        } else if (eventType === "question.asked") {
          peer.send(JSON.stringify({ type: "question:asked", data: event.properties }));
        } else if (eventType === "question.replied" || eventType === "question.rejected") {
          peer.send(JSON.stringify({ type: "question:resolved", data: event.properties }));
        } else if (eventType === "signal") {
          peer.send(JSON.stringify({ type: "signal", data: event.properties }));
        } else if (eventType === "signal.resolved") {
          peer.send(JSON.stringify({ type: "signal.resolved", data: event.properties }));
        }
      } catch {
        // peer might be closed
      }
    };

    emitter.on("event", handleEvent);

    (peer as any)._cleanup = () => {
      emitter.off("event", handleEvent);
    };

    // Fetch initial data for the active session
    const t1 = Date.now();
    Promise.all([
      fetchAndSendStatus(peer, port, sessionId),
      fetchAndSendMessages(peer, port, sessionId),
      fetchAndSendSignals(peer),
      fetchAndSendPermissions(peer, port),
      fetchAndSendQuestions(peer, port),
    ]).then(() => {
      console.log(`[ws:open] Initial data fetched: ${Date.now() - t1}ms (total: ${Date.now() - t0}ms)`);
    }).catch(() => {});
  },

  async message(peer: Peer, message: Message) {
    const info = peerInfo.get(peer.id);
    if (!info) return;

    let msg: { type: string; data?: any };
    try {
      msg = JSON.parse(message.text());
    } catch {
      return;
    }

    const { port, sessionId } = info;

    switch (msg.type) {
      case "prompt": {
        const { message: text, agent, model, attachments, sessionId: targetSessionId } = msg.data || {};
        if (!text && !attachments?.length) return;

        const promptSessionId = targetSessionId || sessionId;

        const parts: any[] = [];
        if (text) parts.push({ type: "text", text });
        if (attachments) {
          for (const att of attachments) {
            parts.push({ type: "file", mime: att.mime, url: att.url, filename: att.filename });
          }
        }

        // model can be "providerId/modelId" composite or plain modelId
        let providerID: string | undefined;
        let modelID: string | undefined;
        if (model && model.includes("/")) {
          const idx = model.indexOf("/");
          providerID = model.slice(0, idx);
          modelID = model.slice(idx + 1);
        } else if (model) {
          modelID = model;
        }

        try {
          await fetch(
            `http://localhost:${port}/session/${promptSessionId}/prompt_async`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                parts,
                ...(agent && { agent }),
                ...(providerID && { providerID }),
                ...(modelID && { modelID }),
              }),
            },
          );
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to send prompt: ${e.message}` },
          }));
        }
        break;
      }

      case "abort": {
        const targetSessionId = msg.data?.sessionId || sessionId;
        try {
          await fetch(
            `http://localhost:${port}/session/${targetSessionId}/abort`,
            { method: "POST" },
          );
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to abort: ${e.message}` },
          }));
        }
        break;
      }

      case "resolve_signal": {
        const { signalId, answer } = msg.data || {};
        if (!signalId || !answer) return;

        try {
          await db
            .update(signals)
            .set({ resolved: true, resolvedContent: answer })
            .where(eq(signals.id, signalId));

          emitOnPort(info.port, {
            type: "signal.resolved",
            properties: { signalId },
          });
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to resolve signal: ${e.message}` },
          }));
        }
        break;
      }

      case "reply_permission": {
        const { requestId, reply, sessionId: permSessionId } = msg.data || {};
        if (!requestId || !reply) return;

        try {
          await fetch(
            `http://localhost:${info.port}/permission/${requestId}/reply`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reply,
                ...(permSessionId && { sessionID: permSessionId }),
              }),
            },
          );
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to reply to permission: ${e.message}` },
          }));
        }
        break;
      }

      case "reply_question": {
        const { requestId, answers } = msg.data || {};
        if (!requestId || !answers) return;

        try {
          await fetch(
            `http://localhost:${info.port}/question/${requestId}/reply`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ answers }),
            },
          );
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to reply to question: ${e.message}` },
          }));
        }
        break;
      }

      case "reject_question": {
        const { requestId } = msg.data || {};
        if (!requestId) return;

        try {
          await fetch(
            `http://localhost:${info.port}/question/${requestId}/reject`,
            { method: "POST" },
          );
        } catch {}
        break;
      }

      case "switch_session": {
        const { sessionId: newSessionId } = msg.data || {};
        if (!newSessionId) return;

        info.sessionId = newSessionId;
        peerInfo.set(peer.id, info);

        // Fetch initial data for the new active session
        Promise.all([
          fetchAndSendStatus(peer, info.port, newSessionId),
          fetchAndSendMessages(peer, info.port, newSessionId),
          fetchAndSendPermissions(peer, info.port),
          fetchAndSendQuestions(peer, info.port),
        ]).then(() => {
          peer.send(JSON.stringify({ type: "session_switched", data: { sessionId: newSessionId } }));
        }).catch(() => {});
        break;
      }

      case "revert": {
        const { messageId } = msg.data || {};
        if (!messageId) return;

        try {
          const res = await fetch(
            `http://localhost:${port}/session/${sessionId}/revert`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageID: messageId }),
            },
          );
          if (res.ok) {
            // Re-fetch messages after revert
            fetchAndSendMessages(peer, port, sessionId);
          }
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to revert: ${e.message}` },
          }));
        }
        break;
      }

      case "fork": {
        const { messageId } = msg.data || {};

        try {
          const res = await fetch(
            `http://localhost:${port}/session/${sessionId}/fork`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(messageId ? { messageID: messageId } : {}),
            },
          );
          const data = await res.json();
          peer.send(JSON.stringify({ type: "forked", data }));
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to fork: ${e.message}` },
          }));
        }
        break;
      }

      case "fetch_session_messages": {
        // Client requests messages for a specific session (e.g. sub-agent)
        const { sessionId: targetId } = msg.data || {};
        if (!targetId) return;

        try {
          const res = await fetch(`http://localhost:${port}/session/${targetId}/message`);
          const messages = await res.json();
          if (Array.isArray(messages)) {
            peer.send(JSON.stringify({
              type: "session:messages",
              data: { sessionId: targetId, messages },
            }));
          }
        } catch {}
        break;
      }

      case "ping":
        break;
    }
  },

  close(peer: Peer) {
    (peer as any)?._cleanup?.();
    peerInfo.delete(peer.id);
  },

  error(peer: Peer, error: Error) {
    console.error(`[ws:project] Error:`, error.message);
    (peer as any)?._cleanup?.();
    peerInfo.delete(peer.id);
  },
});

async function fetchAndSendStatus(peer: Peer, port: number, sessionId: string) {
  try {
    const res = await fetch(`http://localhost:${port}/session/status`);
    const statusMap = await res.json();
    // Send status for all sessions so client knows about child sessions too
    for (const [sid, status] of Object.entries(statusMap)) {
      peer.send(JSON.stringify({ type: "status", data: { ...(status as any), sessionID: sid } }));
    }
  } catch {
    peer.send(JSON.stringify({ type: "status", data: { type: "idle", sessionID: sessionId } }));
  }
}

async function fetchAndSendMessages(peer: Peer, port: number, sessionId: string) {
  try {
    const res = await fetch(`http://localhost:${port}/session/${sessionId}/message`);
    const messages = await res.json();
    if (Array.isArray(messages)) {
      peer.send(JSON.stringify({ type: "messages", data: messages }));
    }
  } catch {
    // server might not be ready
  }
}

async function fetchAndSendSignals(peer: Peer) {
  try {
    const pending = await db
      .select()
      .from(signals)
      .where(eq(signals.resolved, false));

    for (const q of pending.filter((s) => s.type === "question")) {
      peer.send(JSON.stringify({ type: "signal", data: q }));
    }
  } catch {}
}

async function fetchAndSendPermissions(peer: Peer, port: number) {
  try {
    const res = await fetch(`http://localhost:${port}/permission`);
    const permissions = await res.json();
    if (Array.isArray(permissions)) {
      for (const p of permissions) {
        peer.send(JSON.stringify({ type: "permission:asked", data: p }));
      }
    }
  } catch {}
}

async function fetchAndSendQuestions(peer: Peer, port: number) {
  try {
    const res = await fetch(`http://localhost:${port}/question`);
    const questions = await res.json();
    if (Array.isArray(questions)) {
      for (const q of questions) {
        peer.send(JSON.stringify({ type: "question:asked", data: q }));
      }
    }
  } catch {}
}
