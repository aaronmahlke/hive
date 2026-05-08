/**
 * Returns the current project's base path for relativizing file paths.
 * Uses the route's project ID to fetch the project data.
 */
const projectPaths = reactive<Record<string, string>>({});
const fetching = new Set<string>();

export function useProjectPath() {
  const route = useRoute();
  const projectId = computed(() => (route.params.id as string) || null);

  const projectPath = computed(() => {
    if (!projectId.value) return null;
    return projectPaths[projectId.value] || null;
  });

  // Fetch and cache the project path
  if (import.meta.client && projectId.value && !projectPaths[projectId.value] && !fetching.has(projectId.value)) {
    const id = projectId.value;
    fetching.add(id);
    $fetch(`/api/projects/${id}`).then((data: any) => {
      if (data?.path) {
        projectPaths[id] = data.path;
      }
    }).catch(() => {}).finally(() => {
      fetching.delete(id);
    });
  }

  // Derive home directory from project path (e.g. /Users/foo/projects/hive → /Users/foo)
  const homeDir = computed(() => {
    const base = projectPath.value;
    if (!base) return null;
    const match = base.match(/^(\/Users\/[^/]+|\/home\/[^/]+)/);
    return match ? match[1] : null;
  });

  function relativePath(fullPath: string): string {
    if (!fullPath) return "";
    const base = projectPath.value;
    if (base && fullPath.startsWith(base)) {
      const rel = fullPath.slice(base.length);
      return rel.startsWith("/") ? rel.slice(1) : rel;
    }
    // Shorten home directory to ~
    const home = homeDir.value;
    if (home && fullPath.startsWith(home)) {
      return "~" + fullPath.slice(home.length);
    }
    return fullPath;
  }

  return { projectPath, relativePath };
}
