import type { Component } from "vue";
import {
  HomeIcon,
  Cog6ToothIcon,
  PlusIcon,
  CodeBracketIcon,
  FolderIcon,
  CommandLineIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
} from "@heroicons/vue/16/solid";

type Command = {
  id: string;
  label: string;
  category: string;
  keywords?: string[];
  icon?: Component;
  shortcut?: string;
  action: () => void | Promise<void>;
};

type PalettePage = {
  id: string;
  title: string;
  placeholder: string;
  commands: Command[];
  onSubmit?: (value: string) => void | Promise<void>;
};

const open = ref(false);
const pages = ref<PalettePage[]>([]);
const searchQuery = ref("");

export function useCommandPalette() {
  const route = useRoute();
  const router = useRouter();

  const projectId = computed(() => (route.params.id as string) || null);
  const { activeWorktreePath, setActive } = useActiveWorktree(projectId);
  const openTabs = useLocalStorage<string[]>("hive:openTabs", []);

  const { data: projects } = useFetch("/api/projects", { default: () => [] });
  const { data: worktrees } = useFetch("/api/worktrees", {
    query: { projectId },
    watch: [projectId],
    default: () => [],
  });

  const currentPage = computed(() => pages.value[pages.value.length - 1] || null);
  const isNested = computed(() => pages.value.length > 0);

  const commands = computed<Command[]>(() => {
    if (currentPage.value) return currentPage.value.commands;

    const cmds: Command[] = [];

    // Navigation
    cmds.push({
      id: "nav:home",
      label: "Go to Home",
      category: "Navigation",
      keywords: ["home", "dashboard", "projects"],
      icon: HomeIcon,
      action: () => router.push("/"),
    });

    cmds.push({
      id: "nav:settings",
      label: "Go to Settings",
      category: "Navigation",
      keywords: ["settings", "preferences", "config"],
      icon: Cog6ToothIcon,
      shortcut: "⌘,",
      action: () => router.push("/settings"),
    });

    // Projects
    for (const proj of projects.value || []) {
      cmds.push({
        id: `project:${proj.id}`,
        label: proj.name,
        category: "Projects",
        keywords: ["project", "switch", proj.path],
        icon: FolderIcon,
        action: () => {
          if (!openTabs.value.includes(proj.id)) {
            openTabs.value.push(proj.id);
          }
          router.push(`/project/${proj.id}`);
        },
      });
    }

    // Worktrees (only when a project is open)
    if (projectId.value) {
      const mainWt = (worktrees.value as any[]).find((w: any) => w.isMain);
      if (mainWt) {
        cmds.push({
          id: "wt:main",
          label: `${mainWt.branchName} (main)`,
          category: "Worktrees",
          keywords: ["worktree", "branch", "main", mainWt.branchName],
          icon: HomeIcon,
          action: () => setActive(null),
        });
      }

      for (const wt of (worktrees.value as any[]).filter((w: any) => !w.isMain)) {
        cmds.push({
          id: `wt:${wt.path}`,
          label: wt.branchName,
          category: "Worktrees",
          keywords: ["worktree", "branch", wt.branchName],
          icon: CodeBracketIcon,
          action: () => setActive(wt.path),
        });
      }
    }

    // Actions
    cmds.push({
      id: "action:open-project",
      label: "Open Project",
      category: "Actions",
      keywords: ["open", "new", "folder", "directory"],
      icon: PlusIcon,
      action: async () => {
        let selectedPath: string | null = null;
        if (window.electronAPI) {
          selectedPath = await window.electronAPI.openDirectory();
        } else {
          selectedPath = prompt("Enter the project path:");
        }
        if (!selectedPath) return;
        const project = await $fetch("/api/projects", {
          method: "POST",
          body: { path: selectedPath },
        }) as any;
        if (!openTabs.value.includes(project.id)) {
          openTabs.value.push(project.id);
        }
        router.push(`/project/${project.id}`);
      },
    });

    if (projectId.value) {
      cmds.push({
        id: "action:create-worktree",
        label: "Create Worktree",
        category: "Actions",
        keywords: ["worktree", "branch", "new", "create"],
        icon: CodeBracketIcon,
        action: () => {
          pushPage({
            id: "create-worktree",
            title: "Create Worktree",
            placeholder: "Enter branch name (e.g. feature/my-branch)...",
            commands: [],
            onSubmit: async (branchName: string) => {
              if (!branchName.trim() || !projectId.value) return;
              const result = await $fetch("/api/worktrees", {
                method: "POST",
                body: { projectId: projectId.value, branchName: branchName.trim() },
              }) as any;
              if (result?.path) setActive(result.path);
              close();
            },
          });
        },
      });

      cmds.push({
        id: "action:focus-chat",
        label: "Focus Chat Input",
        category: "Actions",
        keywords: ["chat", "input", "focus", "type"],
        icon: CommandLineIcon,
        shortcut: "⌘L",
        action: () => {
          const input = document.querySelector("textarea[data-chat-input]") as HTMLTextAreaElement;
          input?.focus();
        },
      });

      const q = searchQuery.value.trim().toLowerCase();
      if (q) {
        const existingBranches = (worktrees.value as any[]).map((w: any) => w.branchName.toLowerCase());
        const matchesExisting = existingBranches.some((b) => b === q);
        if (!matchesExisting) {
          const branchName = searchQuery.value.trim();
          cmds.push({
            id: `create-wt:${branchName}`,
            label: `Create worktree: ${branchName}`,
            category: "Create",
            keywords: [branchName, "create", "worktree", "branch", "new"],
            icon: PlusIcon,
            action: async () => {
              if (!projectId.value) return;
              const result = await $fetch("/api/worktrees", {
                method: "POST",
                body: { projectId: projectId.value, branchName },
              }) as any;
              if (result?.path) setActive(result.path);
              close();
            },
          });
        }
      }
    }

    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return cmds;

    return cmds.filter((cmd) => {
      const target = [cmd.label, ...(cmd.keywords || [])].join(" ").toLowerCase();
      return target.includes(query);
    });
  });

  function toggle() {
    open.value = !open.value;
    if (!open.value) pages.value = [];
  }

  function close() {
    open.value = false;
    pages.value = [];
  }

  function pushPage(page: PalettePage) {
    pages.value = [...pages.value, page];
  }

  function popPage() {
    if (pages.value.length > 0) {
      pages.value = pages.value.slice(0, -1);
    }
  }

  return {
    open,
    searchQuery,
    commands,
    currentPage,
    isNested,
    toggle,
    close,
    pushPage,
    popPage,
  };
}
