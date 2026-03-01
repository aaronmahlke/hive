/**
 * Global Hive store.
 *
 * Manages all project chat instances via Vercel AI SDK's `Chat` class.
 * Each project gets its own `Chat` instance stored in a Map.
 * No more WebSocket connections or OpenCode process management.
 *
 * Usage:
 *   const store = useHiveStore()
 *   await store.activate(projectId)          // load project data
 *   const project = store.project(id)        // reactive project state + chat
 *   store.setModel(id, 'opus')               // switch model preference
 *   store.resolveSignal(id, signalId, 'yes') // answer a pending question
 *   store.deactivate(id)                     // cleanup
 */

import { Chat } from "@ai-sdk/vue";
import { DefaultChatTransport } from "ai";
import type { UIMessage, FileUIPart } from "ai";

type Signal = {
  id: string;
  type: string;
  content: string;
  options?: string[] | null;
  resolved: boolean;
};

type ProjectEntry = {
  chat: Chat<UIMessage>;
  modelPreference: Ref<"opus" | "sonnet">;
  projectName: Ref<string>;
  connected: Ref<boolean>;
  initializing: Ref<boolean>;
  pendingQuestions: Ref<Signal[]>;
};

// Singleton state — survives across component mounts/unmounts
const projectMap = new Map<string, ProjectEntry>();

function ensureProject(projectId: string): ProjectEntry {
  let entry = projectMap.get(projectId);
  if (entry) return entry;

  const modelPreference = ref<"opus" | "sonnet">("sonnet");
  const projectName = ref("");
  const connected = ref(false);
  const initializing = ref(false);
  const pendingQuestions = ref<Signal[]>([]);

  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        projectId,
        model: modelPreference.value,
      }),
    }),
    onError: (err) => {
      console.error(`[hive:chat:${projectId}]`, err.message);
    },
  });

  entry = {
    chat,
    modelPreference,
    projectName,
    connected,
    initializing,
    pendingQuestions,
  };

  projectMap.set(projectId, entry);
  return entry;
}

export function useHiveStore() {
  /**
   * Initialize a project: load project data and mark as connected.
   * Safe to call multiple times — skips if already initialized.
   */
  async function activate(projectId: string) {
    const entry = ensureProject(projectId);

    // Already connected or initializing
    if (entry.connected.value || entry.initializing.value) return;

    entry.initializing.value = true;

    try {
      const data = await $fetch<{ name: string }>(`/api/projects/${projectId}`);
      entry.projectName.value = data?.name ?? "";
      entry.connected.value = true;
    } catch (e: any) {
      console.error(`[hive:activate:${projectId}]`, e.message);
    } finally {
      entry.initializing.value = false;
    }
  }

  /**
   * Tear down a project's state.
   */
  function deactivate(projectId: string) {
    const entry = projectMap.get(projectId);
    if (entry) {
      entry.chat.stop();
    }
    projectMap.delete(projectId);
  }

  /**
   * Get reactive state for a project.
   * The Chat class exposes reactive Vue refs for messages, status, and error
   * via its internal VueChatState.
   */
  function project(projectId: string) {
    const entry = ensureProject(projectId);
    const chat = entry.chat;

    // Access the internal VueChatState refs for Vue reactivity.
    // The Chat class's getters (messages, status, error) return plain values,
    // but the underlying state holds Vue refs that we can bind to templates.
    const state = (chat as any).state;
    const messagesRef = state.messagesRef as Ref<UIMessage[]>;
    const statusRef = state.statusRef as Ref<string>;
    const errorRef = state.errorRef as Ref<Error | undefined>;

    const isLoading = computed(() => statusRef.value === "streaming" || statusRef.value === "submitted");

    return {
      // Chat reactivity
      messages: messagesRef,
      status: statusRef,
      isLoading,
      error: errorRef,

      // Chat actions
      sendMessage: (text: string, files?: FileUIPart[]) => chat.sendMessage({ text, files }),
      stop: () => chat.stop(),

      // Custom state
      modelPreference: entry.modelPreference,
      projectName: entry.projectName,
      connected: entry.connected,
      initializing: entry.initializing,
      pendingQuestions: entry.pendingQuestions,
    };
  }

  /**
   * Switch model preference for a project.
   */
  function setModel(projectId: string, model: "opus" | "sonnet") {
    const entry = ensureProject(projectId);
    entry.modelPreference.value = model;
  }

  /**
   * Resolve a pending signal/question.
   */
  async function resolveSignal(projectId: string, signalId: string, answer: string) {
    const entry = projectMap.get(projectId);
    if (!entry) return;

    try {
      await $fetch(`/api/signals/${signalId}`, {
        method: "POST",
        body: { answer },
      });
    } catch (e: any) {
      console.error(`[hive:resolveSignal:${projectId}]`, e.message);
    }

    // Optimistic removal
    entry.pendingQuestions.value = entry.pendingQuestions.value.filter(
      (q) => q.id !== signalId,
    );
  }

  return {
    activate,
    deactivate,
    project,
    setModel,
    resolveSignal,
  };
}
