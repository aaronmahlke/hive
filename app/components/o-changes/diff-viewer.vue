<script lang="ts">
import type {
  FileDiffMetadata,
  DiffLineAnnotation,
  SelectedLineRange,
} from "@pierre/diffs";

type CommentMeta = {
  type: "comment";
  id: string;
  content: string;
  resolved: boolean;
};
</script>

<script setup lang="ts">
type Props = {
  fileDiff: FileDiffMetadata;
  filePath: string;
  comments: any[];
};

type Emits = {
  "add-comment": [comment: {
    filePath: string;
    startLine: number;
    endLine: number;
    side?: "additions" | "deletions";
    content: string;
  }];
  "delete-comment": [commentId: string];
};

const { fileDiff, filePath, comments } = defineProps<Props>();
const emit = defineEmits<Emits>();

const containerRef = ref<HTMLDivElement>();
let diffInstance: any = null;

// Comment input state
const showCommentInput = ref(false);
const commentInputText = ref("");
const selectedRange = ref<SelectedLineRange | null>(null);

function buildAnnotations(): DiffLineAnnotation<CommentMeta>[] {
  const annotations: DiffLineAnnotation<CommentMeta>[] = [];
  for (const c of comments) {
    annotations.push({
      side: (c.side as "additions" | "deletions") || "additions",
      lineNumber: c.endLine,
      metadata: {
        type: "comment",
        id: c.id,
        content: c.content,
        resolved: c.resolved,
      },
    });
  }
  return annotations;
}

function createCommentElement(meta: CommentMeta): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.padding = "8px 12px";
  wrapper.style.margin = "4px 0";
  wrapper.style.borderRadius = "6px";
  wrapper.style.fontSize = "13px";
  wrapper.style.lineHeight = "1.5";
  wrapper.style.background = "rgba(255,255,255,0.05)";
  wrapper.style.border = "1px solid rgba(255,255,255,0.1)";

  if (meta.resolved) {
    wrapper.style.opacity = "0.5";
  }

  const text = document.createElement("p");
  text.textContent = meta.content || "";
  text.style.margin = "0";
  wrapper.appendChild(text);

  if (!meta.resolved) {
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.marginTop = "4px";
    deleteBtn.style.fontSize = "11px";
    deleteBtn.style.opacity = "0.5";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.border = "none";
    deleteBtn.style.background = "none";
    deleteBtn.style.padding = "0";
    deleteBtn.style.color = "inherit";
    deleteBtn.addEventListener("click", () => {
      emit("delete-comment", meta.id);
    });
    wrapper.appendChild(deleteBtn);
  }

  return wrapper;
}

async function renderDiff() {
  if (!containerRef.value || !fileDiff) return;

  if (diffInstance) {
    diffInstance.cleanUp();
    diffInstance = null;
  }
  containerRef.value.innerHTML = "";

  try {
    const { FileDiff } = await import("@pierre/diffs");

    const instance = new FileDiff<CommentMeta>({
      diffStyle: "unified",
      diffIndicators: "bars",
      lineDiffType: "word-alt",
      themeType: "dark",
      disableFileHeader: true,
      enableLineSelection: true,
      overflow: "scroll",

      onLineSelected(range: SelectedLineRange | null) {
        if (range) {
          selectedRange.value = range;
          showCommentInput.value = true;
          commentInputText.value = "";
        }
      },

      renderAnnotation(annotation: DiffLineAnnotation<CommentMeta>) {
        if (annotation.metadata) {
          return createCommentElement(annotation.metadata);
        }
        return document.createElement("div");
      },
    });

    instance.render({
      fileDiff,
      containerWrapper: containerRef.value,
      lineAnnotations: buildAnnotations(),
    });

    diffInstance = instance;
  } catch (e) {
    console.error("[diff-viewer] Failed:", e);
  }
}

function updateAnnotations() {
  if (diffInstance) {
    diffInstance.setLineAnnotations(buildAnnotations());
  }
}

function submitComment() {
  if (!commentInputText.value.trim() || !selectedRange.value) return;

  emit("add-comment", {
    filePath,
    startLine: selectedRange.value.start,
    endLine: selectedRange.value.end,
    side: (selectedRange.value.side as "additions" | "deletions") || undefined,
    content: commentInputText.value.trim(),
  });

  showCommentInput.value = false;
  commentInputText.value = "";
  selectedRange.value = null;
  if (diffInstance) {
    diffInstance.setSelectedLines(null);
  }
}

function cancelComment() {
  showCommentInput.value = false;
  commentInputText.value = "";
  selectedRange.value = null;
  if (diffInstance) {
    diffInstance.setSelectedLines(null);
  }
}

onMounted(() => renderDiff());
watch(() => fileDiff, () => renderDiff());
watch(() => comments, () => updateAnnotations(), { deep: true });

onUnmounted(() => {
  if (diffInstance) {
    diffInstance.cleanUp();
    diffInstance = null;
  }
});
</script>

<template>
  <div class="relative">
    <div ref="containerRef" class="min-h-0" />

    <!-- Comment input — floating at bottom when lines are selected -->
    <Teleport to="body">
      <div
        v-if="showCommentInput"
        class="fixed bottom-4 left-1/2 z-50 w-96 -translate-x-1/2"
      >
        <div class="bg-base-2 border-edge rounded-lg border p-3 shadow-lg">
          <p class="text-copy-xs text-tertiary mb-1.5">
            Comment on
            {{
              selectedRange?.start === selectedRange?.end
                ? `line ${selectedRange?.start}`
                : `lines ${selectedRange?.start}-${selectedRange?.end}`
            }}
          </p>
          <textarea
            v-model="commentInputText"
            class="text-copy-sm text-primary bg-surface-1 border-edge w-full resize-none rounded-md border p-2 outline-none focus:border-accent"
            rows="3"
            placeholder="Add review feedback..."
            autofocus
            @keydown.enter.meta.prevent="submitComment"
            @keydown.escape.prevent="cancelComment"
          />
          <div class="mt-2 flex justify-end gap-1.5">
            <OButton variant="transparent" size="sm" @click="cancelComment">
              Cancel
            </OButton>
            <OButton
              variant="primary"
              size="sm"
              :disabled="!commentInputText.trim()"
              @click="submitComment"
            >
              Comment
            </OButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
