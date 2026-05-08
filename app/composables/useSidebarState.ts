const leftCollapsed = useLocalStorage("hive:sidebar-left-collapsed", false);
const rightCollapsed = useLocalStorage("hive:sidebar-right-collapsed", false);

export function useSidebarState() {
  return {
    leftCollapsed,
    rightCollapsed,
    toggleLeft: () => { leftCollapsed.value = !leftCollapsed.value; },
    toggleRight: () => { rightCollapsed.value = !rightCollapsed.value; },
  };
}
