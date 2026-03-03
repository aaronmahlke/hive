import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs";

type ChangedFile = {
  path: string;
  status: string;
  staged: boolean;
  modifiedAfterStaged?: boolean;
};

type ChangeComment = {
  id: string;
  projectId: string;
  worktreePath: string | null;
  sessionId: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  side: "additions" | "deletions" | null;
  content: string;
  resolved: boolean;
  createdAt: string;
};

type DiffMode = "combined" | "staged" | "unstaged";

const files = ref<ChangedFile[]>([]);
const rawDiff = ref("");
const rawStagedDiff = ref("");
const rawUnstagedDiff = ref("");
const loading = ref(false);
const ahead = ref(0);
const behind = ref(0);
const branch = ref<string | null>(null);
const comments = ref<ChangeComment[]>([]);
const viewedFiles = ref(new Set<string>());
const selectedFile = ref<string | null>(null);
const selectedDiffMode = ref<DiffMode>("combined");
const selectedFileContent = ref<string | null>(null);
const loadingFileContent = ref(false);
const commentInputActive = ref(false);
let activeProjectId: string | null = null;

function parseDiff(raw: string): Map<string, FileDiffMetadata> {
  if (!raw) return new Map();
  try {
    const parsed = parsePatchFiles(raw);
    const map = new Map<string, FileDiffMetadata>();
    for (const patch of parsed) {
      for (const file of patch.files) {
        map.set(file.name, file);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export function useChanges() {
  const route = useRoute();
  const projectId = computed(() => (route.params.id as string) || null);
  const { activeWorktreePath } = useActiveWorktree(projectId);

  const parsedCombined = computed(() => parseDiff(rawDiff.value));
  const parsedStaged = computed(() => parseDiff(rawStagedDiff.value));
  const parsedUnstaged = computed(() => parseDiff(rawUnstagedDiff.value));

  // Legacy alias
  const parsedFiles = parsedCombined;

  const selectedFileDiff = computed(() => {
    if (!selectedFile.value) return null;
    const map =
      selectedDiffMode.value === "staged" ? parsedStaged.value
      : selectedDiffMode.value === "unstaged" ? parsedUnstaged.value
      : parsedCombined.value;
    return map.get(selectedFile.value) || null;
  });

  const unresolvedComments = computed(() =>
    comments.value.filter((c) => !c.resolved),
  );

  const selectedFileComments = computed(() =>
    comments.value.filter((c) => c.filePath === selectedFile.value),
  );

  const worktreeQuery = computed(() => {
    const q: Record<string, string> = {};
    if (activeWorktreePath.value) q.worktreePath = activeWorktreePath.value;
    return q;
  });

  async function fetchChanges() {
    const id = projectId.value;
    if (!id) return;
    loading.value = true;
    try {
      const data = await $fetch(`/api/projects/${id}/changes`, { query: worktreeQuery.value });
      files.value = (data as any).files || [];
      rawDiff.value = (data as any).diff || "";
      rawStagedDiff.value = (data as any).stagedDiff || "";
      rawUnstagedDiff.value = (data as any).unstagedDiff || "";
      ahead.value = (data as any).ahead ?? 0;
      behind.value = (data as any).behind ?? 0;
      branch.value = (data as any).branch ?? null;
      viewedFiles.value = new Set(
        files.value.filter((f) => f.staged).map((f) => f.path),
      );
    } catch (e) {
      console.error("[changes] Failed to fetch:", e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchComments() {
    const id = projectId.value;
    if (!id) return;
    try {
      const data = await $fetch(`/api/projects/${id}/change-comments`, {
        query: worktreeQuery.value,
      });
      comments.value = data as ChangeComment[];
    } catch (e) {
      console.error("[changes] Failed to fetch comments:", e);
    }
  }

  async function addComment(comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
  }) {
    const id = projectId.value;
    if (!id) return;

    const optimisticId = `temp-${Date.now()}`;
    comments.value = [
      ...comments.value,
      {
        id: optimisticId,
        projectId: id,
        worktreePath: activeWorktreePath.value,
        sessionId: null,
        filePath: comment.filePath,
        startLine: comment.startLine,
        endLine: comment.endLine,
        side: comment.side || null,
        content: comment.content,
        resolved: false,
        createdAt: new Date().toISOString(),
      },
    ];

    try {
      await $fetch(`/api/projects/${id}/change-comments`, {
        method: "POST",
        body: {
          ...comment,
          ...(activeWorktreePath.value && { worktreePath: activeWorktreePath.value }),
        },
      });
      await fetchComments();
    } catch (e) {
      comments.value = comments.value.filter((c) => c.id !== optimisticId);
      console.error("[changes] Failed to add comment:", e);
    }
  }

  async function deleteComment(commentId: string) {
    const id = projectId.value;
    if (!id) return;

    const prev = comments.value;
    comments.value = comments.value.filter((c) => c.id !== commentId);

    try {
      await $fetch(`/api/projects/${id}/change-comments/${commentId}`, {
        method: "DELETE",
      });
    } catch (e) {
      comments.value = prev;
      console.error("[changes] Failed to delete comment:", e);
    }
  }

  async function updateComment(commentId: string, content: string) {
    const id = projectId.value;
    if (!id || !content.trim()) return;

    const prev = comments.value;
    comments.value = comments.value.map((c) =>
      c.id === commentId ? { ...c, content: content.trim() } : c,
    );

    try {
      await $fetch(`/api/projects/${id}/change-comments/${commentId}`, {
        method: "PATCH",
        body: { content: content.trim() },
      });
    } catch (e) {
      comments.value = prev;
      console.error("[changes] Failed to update comment:", e);
    }
  }

  async function stageFile(path: string) {
    const id = projectId.value;
    if (!id) return;
    try {
      await $fetch(`/api/projects/${id}/stage`, {
        method: "POST",
        body: { path, ...worktreeQuery.value },
      });
    } catch (e) {
      console.error("[changes] Failed to stage:", e);
    }
  }

  async function unstageFile(path: string) {
    const id = projectId.value;
    if (!id) return;
    try {
      await $fetch(`/api/projects/${id}/stage`, {
        method: "POST",
        body: { path, unstage: true, ...worktreeQuery.value },
      });
    } catch (e) {
      console.error("[changes] Failed to unstage:", e);
    }
  }

  function toggleViewed(path: string) {
    const newSet = new Set(viewedFiles.value);
    if (newSet.has(path)) {
      newSet.delete(path);
      unstageFile(path);
    } else {
      newSet.add(path);
      stageFile(path);
    }
    viewedFiles.value = newSet;
  }

  function markViewedAndNext(path: string) {
    const newSet = new Set(viewedFiles.value);
    const wasViewed = newSet.has(path);
    if (wasViewed) {
      newSet.delete(path);
      viewedFiles.value = newSet;
      unstageFile(path);
      return;
    }

    newSet.add(path);
    viewedFiles.value = newSet;
    stageFile(path);

    const currentIndex = files.value.findIndex((f) => f.path === path);
    for (let i = 1; i <= files.value.length; i++) {
      const nextIndex = (currentIndex + i) % files.value.length;
      const nextFile = files.value[nextIndex];
      if (!newSet.has(nextFile.path)) {
        selectFile(nextFile.path);
        return;
      }
    }

    closeOverlay();
  }

  async function fetchFileContent(filePath: string) {
    const id = projectId.value;
    if (!id) return;
    loadingFileContent.value = true;
    try {
      const query: Record<string, string> = { path: filePath, ...worktreeQuery.value };
      const data = await $fetch(`/api/projects/${id}/file-content`, { query });
      selectedFileContent.value = (data as any).content || "";
    } catch (e) {
      console.error("[changes] Failed to fetch file content:", e);
      selectedFileContent.value = null;
    } finally {
      loadingFileContent.value = false;
    }
  }

  function selectFile(path: string, mode?: DiffMode) {
    if (selectedFile.value === path && selectedDiffMode.value === (mode || "combined")) {
      selectedFile.value = null;
      selectedFileContent.value = null;
      return;
    }
    selectedFile.value = path;
    selectedFileContent.value = null;

    if (mode) {
      selectedDiffMode.value = mode;
    } else {
      // Auto-detect: if file only has staged changes, show staged; if only unstaged, show combined
      const file = files.value.find((f) => f.path === path);
      if (file?.modifiedAfterStaged) {
        selectedDiffMode.value = "combined";
      } else {
        selectedDiffMode.value = "combined";
      }
    }

    const map =
      selectedDiffMode.value === "staged" ? parsedStaged.value
      : selectedDiffMode.value === "unstaged" ? parsedUnstaged.value
      : parsedCombined.value;

    if (!map.has(path)) {
      fetchFileContent(path);
    }
  }

  function closeOverlay() {
    selectedFile.value = null;
    selectedFileContent.value = null;
  }

  async function requestChanges() {
    const id = projectId.value;
    if (!id || !unresolvedComments.value.length) return;

    const store = useHiveStore();

    const lines = ["Please address the following review feedback:\n"];

    const byFile = new Map<string, ChangeComment[]>();
    for (const c of unresolvedComments.value) {
      const existing = byFile.get(c.filePath) || [];
      existing.push(c);
      byFile.set(c.filePath, existing);
    }

    for (const [filePath, fileComments] of byFile) {
      for (const c of fileComments) {
        const lineRange =
          c.startLine === c.endLine
            ? `line ${c.startLine}`
            : `lines ${c.startLine}-${c.endLine}`;
        lines.push(`## ${filePath} (${lineRange})`);
        lines.push(c.content);
        lines.push("");
      }
    }

    lines.push(
      "---\nAfter making changes, let me know when you're ready for another review.",
    );

    const connectionKey = activeWorktreePath.value
      ? `wt:${activeWorktreePath.value}`
      : id;
    store.sendPrompt(connectionKey, lines.join("\n"));

    const ids = unresolvedComments.value.map((c) => c.id);
    try {
      await $fetch(`/api/projects/${id}/change-comments/resolve`, {
        method: "PATCH",
        body: { ids },
      });
      await fetchComments();
    } catch (e) {
      console.error("[changes] Failed to resolve comments:", e);
    }

    closeOverlay();
  }

  const commitMessage = computed(() => {
    const staged = files.value.filter((f) => f.staged);
    const modified = staged.filter((f) => f.status === "M").map((f) => f.path.split("/").pop());
    const added = staged.filter((f) => f.status === "A" || f.status === "?").map((f) => f.path.split("/").pop());
    const deleted = staged.filter((f) => f.status === "D").map((f) => f.path.split("/").pop());

    const total = staged.length;
    if (total === 0) return "";

    const lines = [`Update ${total} file${total !== 1 ? "s" : ""}`];
    if (modified.length) lines.push(`\nModified: ${modified.join(", ")}`);
    if (added.length) lines.push(`Added: ${added.join(", ")}`);
    if (deleted.length) lines.push(`Deleted: ${deleted.join(", ")}`);

    return lines.join("\n");
  });

  const committing = ref(false);
  const commitError = ref<string | null>(null);

  async function commit(message: string) {
    const id = projectId.value;
    if (!id || !message.trim()) return false;

    committing.value = true;
    commitError.value = null;

    try {
      await $fetch(`/api/projects/${id}/commit`, {
        method: "POST",
        body: {
          message: message.trim(),
          ...(activeWorktreePath.value && { worktreePath: activeWorktreePath.value }),
        },
      });

      viewedFiles.value = new Set();
      selectedFile.value = null;
      selectedFileContent.value = null;
      await fetchChanges();

      return true;
    } catch (e: any) {
      console.error("[changes] Commit failed:", e);
      commitError.value = e.data?.message || e.message || "Failed to commit";
      return false;
    } finally {
      committing.value = false;
    }
  }

  const pushing = ref(false);
  const pushError = ref<string | null>(null);

  async function push() {
    const id = projectId.value;
    if (!id) return false;

    pushing.value = true;
    pushError.value = null;

    try {
      await $fetch(`/api/projects/${id}/push`, {
        method: "POST",
        body: worktreeQuery.value,
      });
      await fetchChanges();
      return true;
    } catch (e: any) {
      pushError.value = e.data?.message || e.message || "Push failed";
      return false;
    } finally {
      pushing.value = false;
    }
  }

  let activeWorktreeKey: string | null = null;

  function init() {
    const id = projectId.value;
    const wtKey = `${id}:${activeWorktreePath.value || "main"}`;

    if (id && wtKey !== activeWorktreeKey) {
      activeProjectId = id;
      activeWorktreeKey = wtKey;
      files.value = [];
      rawDiff.value = "";
      rawStagedDiff.value = "";
      rawUnstagedDiff.value = "";
      comments.value = [];
      viewedFiles.value = new Set();
      selectedFile.value = null;
      fetchChanges();
      fetchComments();
    }
  }

  return {
    files,
    rawDiff,
    loading,
    comments,
    viewedFiles,
    selectedFile,
    selectedDiffMode,
    selectedFileContent,
    loadingFileContent,
    commentInputActive,
    parsedFiles,
    selectedFileDiff,
    selectedFileComments,
    unresolvedComments,
    commitMessage,
    committing,
    commitError,
    ahead,
    behind,
    branch,
    pushing,
    pushError,

    fetchChanges,
    fetchComments,
    addComment,
    deleteComment,
    updateComment,
    toggleViewed,
    markViewedAndNext,
    selectFile,
    closeOverlay,
    requestChanges,
    commit,
    push,
    init,
  };
}
