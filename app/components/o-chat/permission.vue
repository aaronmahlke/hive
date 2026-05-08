<script setup lang="ts">
import { ShieldCheckIcon } from "@heroicons/vue/16/solid";

type PermissionRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, any>;
  always: string[];
  tool?: { messageID: string; callID: string };
};

type Props = {
  permission: PermissionRequest;
};

type Emits = {
  reply: [requestId: string, reply: "once" | "always" | "reject", sessionId: string];
};

const { permission } = defineProps<Props>();
const emit = defineEmits<Emits>();

const label = computed(() => {
  const p = permission.permission;
  const pattern = permission.patterns?.[0] || "";
  if (p === "bash") return `Run command: ${pattern}`;
  if (p === "edit") return `Edit file: ${pattern}`;
  if (p === "external_directory") return `Access outside project: ${pattern}`;
  if (p === "doom_loop") return "Repeated tool call detected";
  if (p === "webfetch") return `Fetch URL: ${pattern}`;
  if (p === "websearch" || p === "codesearch") return `Search: ${pattern}`;
  if (p === "task") return `Launch agent: ${pattern}`;
  if (p === "skill") return `Load skill: ${pattern}`;
  return `${p}: ${pattern}`;
});
</script>

<template>
  <div class="px-3 py-2.5">
    <div class="flex items-start gap-2">
      <ShieldCheckIcon class="text-accent mt-0.5 size-4 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="text-copy text-primary">{{ label }}</p>
        <div class="mt-2 flex gap-1.5">
          <button
            type="button"
            class="bg-accent text-accent-on text-copy rounded-md px-2.5 py-1 transition-colors hover:opacity-90"
            @click="emit('reply', permission.id, 'once', permission.sessionID)"
          >
            Allow
          </button>
          <button
            type="button"
            class="bg-base-2 border-neutral text-copy text-primary hover:bg-subtle rounded-md border px-2.5 py-1 transition-colors"
            @click="emit('reply', permission.id, 'always', permission.sessionID)"
          >
            Always
          </button>
          <button
            type="button"
            class="text-copy text-danger hover:bg-danger-subtle rounded-md px-2.5 py-1 transition-colors"
            @click="emit('reply', permission.id, 'reject', permission.sessionID)"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
