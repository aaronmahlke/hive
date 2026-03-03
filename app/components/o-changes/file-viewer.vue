<script setup lang="ts">
import type { SupportedLanguages } from "@pierre/diffs";
import { getLangFromPath } from "~/utils/diff-highlight";
type Props = {
  content: string;
  filePath: string;
};

const { content, filePath } = defineProps<Props>();

const containerRef = ref<HTMLDivElement>();
let fileInstance: any = null;

async function renderFile() {
  if (!containerRef.value || !content) return;

  if (fileInstance) {
    fileInstance.cleanUp();
    fileInstance = null;
  }
  containerRef.value.innerHTML = "";

  try {
    const { File: PierreFile } = await import("@pierre/diffs");
    const lang = getLangFromPath(filePath);

    fileInstance = new PierreFile({
      themeType: "dark",
      overflow: "scroll",
      disableFileHeader: true,
    });

    // Use containerWrapper so pierre creates its own
    // <diffs-container> with shadow DOM inside our div
    fileInstance.render({
      file: {
        name: filePath,
        contents: content,
        lang,
      },
      containerWrapper: containerRef.value,
    });
  } catch (e) {
    console.error("[file-viewer] Failed to render:", e);
  }
}

onMounted(() => renderFile());
watch(() => content, () => renderFile());
watch(() => filePath, () => renderFile());

onUnmounted(() => {
  if (fileInstance) {
    fileInstance.cleanUp();
    fileInstance = null;
  }
});
</script>

<template>
  <div ref="containerRef" class="min-h-0" />
</template>
