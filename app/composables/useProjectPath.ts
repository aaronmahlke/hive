/**
 * Returns the current project's base path for relativizing file paths.
 * Uses the route's project ID to fetch the project data.
 */
const projectPaths = new Map<string, string>();

export function useProjectPath() {
  const route = useRoute();
  const projectId = computed(() => (route.params.id as string) || null);

  const projectPath = computed(() => {
    if (!projectId.value) return null;
    return projectPaths.get(projectId.value) || null;
  });

  // Fetch and cache the project path
  if (import.meta.client && projectId.value && !projectPaths.has(projectId.value)) {
    $fetch(`/api/projects/${projectId.value}`).then((data: any) => {
      if (data?.path) {
        projectPaths.set(projectId.value!, data.path);
      }
    }).catch(() => {});
  }

  function relativePath(fullPath: string): string {
    const base = projectPath.value;
    if (!base || !fullPath) return fullPath || "";
    if (fullPath.startsWith(base)) {
      const rel = fullPath.slice(base.length);
      return rel.startsWith("/") ? rel.slice(1) : rel;
    }
    return fullPath;
  }

  return { projectPath, relativePath };
}
