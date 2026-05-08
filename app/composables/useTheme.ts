import { ref, computed } from "vue";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "hive:theme";

const mode = ref<ThemeMode>("dark");

if (import.meta.client) {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    mode.value = stored;
  }
}

function getResolvedTheme(): "light" | "dark" {
  if (!import.meta.client) return "dark";
  if (mode.value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode.value;
}

function applyTheme() {
  if (!import.meta.client) return;
  document.documentElement.setAttribute("data-theme", getResolvedTheme());
}

function setMode(next: ThemeMode) {
  mode.value = next;
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme();
}

function toggleMode() {
  const resolved = getResolvedTheme();
  setMode(resolved === "dark" ? "light" : "dark");
}

// Apply on load
if (import.meta.client) {
  applyTheme();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (mode.value === "system") {
      applyTheme();
    }
  });
}

export function useTheme() {
  const resolved = computed(() => getResolvedTheme());
  return {
    mode,
    resolved,
    setMode,
    toggleMode,
  } as const;
}
