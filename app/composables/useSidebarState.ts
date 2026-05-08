const leftCollapsed = ref(false);
const rightCollapsed = ref(false);

if (import.meta.client) {
  const storedLeft = localStorage.getItem("hive:sidebar-left-collapsed");
  if (storedLeft !== null) leftCollapsed.value = storedLeft === "true";
  const storedRight = localStorage.getItem("hive:sidebar-right-collapsed");
  if (storedRight !== null) rightCollapsed.value = storedRight === "true";

  watch(leftCollapsed, (v) => localStorage.setItem("hive:sidebar-left-collapsed", String(v)));
  watch(rightCollapsed, (v) => localStorage.setItem("hive:sidebar-right-collapsed", String(v)));
}

export function useSidebarState() {
  return {
    leftCollapsed,
    rightCollapsed,
    toggleLeft: () => { leftCollapsed.value = !leftCollapsed.value; },
    toggleRight: () => { rightCollapsed.value = !rightCollapsed.value; },
  };
}
