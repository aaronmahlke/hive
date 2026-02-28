import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface ProjectInfo {
  name: string;
  pkgManager: "bun" | "npm" | "pnpm" | "yarn" | null;
  devCommand: string | null;
  installCommand: string | null;
}

export function detectProject(projectPath: string): ProjectInfo {
  const pkgJsonPath = join(projectPath, "package.json");
  let name = projectPath.split("/").pop() || "unknown";
  let devCommand: string | null = null;

  // Read package.json if it exists
  if (existsSync(pkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      name = pkgJson.name || name;
      if (pkgJson.scripts?.dev) {
        devCommand = "dev";
      }
    } catch {
      // ignore parse errors
    }
  }

  // Detect package manager from lockfile
  const pkgManager = detectPackageManager(projectPath);

  // Build install and dev commands
  const installCommand = pkgManager ? `${pkgManager} install` : null;
  const fullDevCommand =
    devCommand && pkgManager ? `${pkgManager} run ${devCommand}` : null;

  return {
    name,
    pkgManager,
    devCommand: fullDevCommand,
    installCommand,
  };
}

function detectPackageManager(
  projectPath: string,
): "bun" | "npm" | "pnpm" | "yarn" | null {
  if (
    existsSync(join(projectPath, "bun.lock")) ||
    existsSync(join(projectPath, "bun.lockb"))
  ) {
    return "bun";
  }
  if (existsSync(join(projectPath, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(projectPath, "yarn.lock"))) {
    return "yarn";
  }
  if (existsSync(join(projectPath, "package-lock.json"))) {
    return "npm";
  }
  // Default to bun if package.json exists but no lockfile
  if (existsSync(join(projectPath, "package.json"))) {
    return "bun";
  }
  return null;
}
