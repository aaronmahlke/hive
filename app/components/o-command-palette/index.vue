<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  ComboboxRoot,
  ComboboxInput,
  ComboboxContent,
  ComboboxViewport,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxItem,
} from "reka-ui";
import { ChevronLeftIcon, CheckIcon } from "@heroicons/vue/16/solid";
import type { Command } from "~/composables/useCommandPalette";

const { open, searchQuery, commands, currentPage, isNested, close, popPage } = useCommandPalette();

watch(open, (val) => {
  if (val) searchQuery.value = "";
});

const grouped = computed(() => {
  const groups = new Map<string, Command[]>();
  for (const cmd of commands.value) {
    const list = groups.get(cmd.category) || [];
    list.push(cmd);
    groups.set(cmd.category, list);
  }
  return groups;
});

function handleSelect(id: any) {
  if (!id) return;
  const command = commands.value.find((c) => c.id === id);
  if (!command) return;
  command.action();
  if (!command.keepOpen) close();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (isNested.value) {
      popPage();
    } else {
      close();
    }
    return;
  }
  if (e.key === "Backspace" && searchQuery.value === "" && isNested.value) {
    e.preventDefault();
    popPage();
  }
  if (e.key === "Enter" && currentPage.value?.onSubmit && searchQuery.value.trim()) {
    const hasMatch = commands.value.some((c) =>
      c.label.toLowerCase().includes(searchQuery.value.toLowerCase()),
    );
    if (!hasMatch || commands.value.length === 0) {
      e.preventDefault();
      currentPage.value.onSubmit(searchQuery.value);
    }
  }
}

const placeholder = computed(() => {
  if (currentPage.value) return currentPage.value.placeholder;
  return "Type a command...";
});
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-[overlayShow_150ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[fade-out_100ms_ease]"
      />
      <DialogContent
        class="fixed top-[20%] left-[50%] z-50 w-[90vw] max-w-[32rem] translate-x-[-50%] rounded-xl shadow-2xl outline-none data-[state=open]:animate-[contentShow_150ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[fade-out_100ms_ease]"
        @escape-key-down.prevent
      >
        <div class="bg-base-2 border-edge overflow-hidden rounded-xl border">
          <ComboboxRoot
            :open="true"
            :model-value="''"
            :filter-function="(list: any[]) => list"
            class="flex flex-col"
            @update:model-value="handleSelect"
          >
            <div class="flex items-center border-b border-edge">
              <button
                v-if="isNested"
                type="button"
                class="text-tertiary hover:text-primary grid size-8 shrink-0 place-items-center"
                @click="popPage"
              >
                <ChevronLeftIcon class="size-4" />
              </button>
              <ComboboxInput
                v-model="searchQuery"
                :placeholder="placeholder"
                class="text-copy text-primary placeholder:text-tertiary h-10 min-w-0 flex-1 bg-transparent px-3 outline-none"
                :class="isNested ? 'pl-0' : ''"
                auto-focus
                @keydown="handleKeydown"
              />
            </div>

            <ComboboxContent position="inline">
              <ComboboxViewport class="max-h-[20rem] overflow-auto p-1">
                <ComboboxEmpty class="text-copy-sm text-tertiary px-3 py-6 text-center">
                  <template v-if="currentPage?.onSubmit && searchQuery.trim()">
                    Press Enter to {{ currentPage.title.toLowerCase() }}
                  </template>
                  <template v-else>
                    No results
                  </template>
                </ComboboxEmpty>

                <ComboboxGroup
                  v-for="[category, cmds] in grouped"
                  :key="category"
                >
                  <ComboboxLabel class="text-copy-xs text-tertiary px-2 pt-2 pb-1 font-medium uppercase tracking-wide">
                    {{ category }}
                  </ComboboxLabel>
                  <ComboboxItem
                    v-for="cmd in cmds"
                    :key="cmd.id"
                    :value="cmd.id"
                    class="text-copy-sm text-primary data-[highlighted]:bg-surface-1 flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 outline-none select-none"
                  >
                    <component
                      v-if="cmd.icon"
                      :is="cmd.icon"
                      class="text-tertiary size-4 shrink-0"
                    />
                    <span class="flex min-w-0 flex-1 items-baseline gap-1.5">
                      <span class="truncate">{{ cmd.label }}</span>
                      <span
                        v-if="cmd.suffix"
                        class="text-tertiary shrink-0"
                      >{{ cmd.suffix }}</span>
                    </span>
                    <CheckIcon
                      v-if="cmd.selected"
                      class="text-tertiary size-3.5 shrink-0"
                    />
                    <span
                      v-if="cmd.shortcut"
                      class="bg-base-3 border-edge text-copy-xs text-tertiary shrink-0 rounded border px-1 py-0.5 font-mono"
                    >
                      {{ cmd.shortcut }}
                    </span>
                  </ComboboxItem>
                </ComboboxGroup>
              </ComboboxViewport>
            </ComboboxContent>
          </ComboboxRoot>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
