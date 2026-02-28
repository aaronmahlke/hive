import { spawn, type ChildProcess } from "child_process";
import { join } from "path";

const processes = new Map<
  string,
  { process: ChildProcess; type: "opencode" | "devserver" }
>();

function getHivePort(): string {
  if (process.env.NUXT_PORT) return process.env.NUXT_PORT;
  if (process.env.PORT) return process.env.PORT;
  if (process.env.NITRO_PORT) return process.env.NITRO_PORT;
  return "3200";
}

/**
 * Check if an OpenCode server is already running and healthy on a port.
 */
export async function isServerHealthy(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/global/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start an OpenCode server for a worktree.
 * Returns the PID.
 * MCP registration happens in the background (non-blocking).
 */
export function startOpenCodeServer(
  worktreePath: string,
  port: number,
  sessionId?: string,
): number {
  const key = `opencode:${worktreePath}`;

  // Kill existing if running
  stopProcess(key);

  const child = spawn(
    "opencode",
    ["serve", "--port", String(port)],
    {
      cwd: worktreePath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      env: {
        ...process.env,
        TERM: "dumb",
      },
    },
  );

  child.stdout?.on("data", (data: Buffer) => {
    console.log(`[opencode:${port}] ${data.toString().trim()}`);
  });

  child.stderr?.on("data", (data: Buffer) => {
    // Don't log every line - too noisy. Only log errors/warnings.
    const text = data.toString().trim();
    if (text.includes("ERROR") || text.includes("WARN") || text.includes("listening")) {
      console.log(`[opencode:${port}] ${text.slice(0, 200)}`);
    }
  });

  child.on("exit", (code) => {
    console.log(`[opencode:${port}] exited with code ${code}`);
    processes.delete(key);
  });

  processes.set(key, { process: child, type: "opencode" });

  // Register MCP in the background - completely non-blocking
  // Use process.cwd() for the path since import.meta.url gets rewritten by Nitro
  const signalServerPath = join(process.cwd(), "server", "mcp", "signal-server.ts");
  registerSignalMcp(port, signalServerPath, sessionId).catch((e) => {
    console.warn(`[opencode:${port}] MCP registration failed (non-fatal):`, e.message);
  });

  return child.pid || 0;
}

/**
 * Wait for server health, then register the signal MCP.
 * Non-blocking - caller does not await this.
 */
async function registerSignalMcp(
  port: number,
  signalServerPath: string,
  sessionId?: string,
) {
  // Wait for the server to be ready (max 15s, not 30s)
  const maxWait = 15_000;
  const start = Date.now();
  let healthy = false;

  while (Date.now() - start < maxWait) {
    if (await isServerHealthy(port)) {
      healthy = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!healthy) {
    console.warn(`[opencode:${port}] Server not ready after ${maxWait}ms, skipping MCP registration`);
    return;
  }

  const hivePort = getHivePort();

  try {
    const controller = new AbortController();
    // Timeout the MCP registration after 10 seconds
    const timeout = setTimeout(() => controller.abort(), 10_000);

    await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        name: "hive",
        config: {
          type: "local",
          command: ["bun", "run", signalServerPath],
          environment: {
            HIVE_API_URL: `http://localhost:${hivePort}`,
            HIVE_SESSION_ID: sessionId || "unknown",
          },
          enabled: true,
        },
      }),
    });

    clearTimeout(timeout);
    console.log(`[opencode:${port}] Registered hive signal MCP`);
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.warn(`[opencode:${port}] MCP registration timed out (non-fatal)`);
    } else {
      console.warn(`[opencode:${port}] MCP registration failed (non-fatal):`, e.message);
    }
  }
}

export function startDevServer(
  worktreePath: string,
  command: string,
): number {
  const key = `devserver:active`;
  stopProcess(key);

  const [cmd, ...args] = command.split(" ");

  const child = spawn(cmd, args, {
    cwd: worktreePath,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    env: { ...process.env, PORT: "3000" },
  });

  child.stdout?.on("data", (data: Buffer) => {
    console.log(`[devserver] ${data.toString().trim()}`);
  });

  child.stderr?.on("data", (data: Buffer) => {
    console.error(`[devserver] ${data.toString().trim()}`);
  });

  child.on("exit", (code) => {
    console.log(`[devserver] exited with code ${code}`);
    processes.delete(key);
  });

  processes.set(key, { process: child, type: "devserver" });
  return child.pid || 0;
}

export function stopProcess(key: string): void {
  const entry = processes.get(key);
  if (entry) {
    entry.process.kill("SIGTERM");
    processes.delete(key);
  }
}

export function stopDevServer(): void {
  stopProcess("devserver:active");
}

export function stopOpenCodeServer(worktreePath: string): void {
  stopProcess(`opencode:${worktreePath}`);
}

export function installDeps(
  worktreePath: string,
  installCommand: string,
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = installCommand.split(" ");
    let output = "";

    const child = spawn(cmd, args, {
      cwd: worktreePath,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => { output += data.toString(); });
    child.stderr?.on("data", (data: Buffer) => { output += data.toString(); });
    child.on("exit", (code) => { resolve({ success: code === 0, output }); });
    child.on("error", (err) => { resolve({ success: false, output: err.message }); });
  });
}

export function cleanupAll(): void {
  for (const [key, entry] of processes) {
    console.log(`Cleaning up process: ${key}`);
    entry.process.kill("SIGTERM");
  }
  processes.clear();
}

process.on("SIGINT", cleanupAll);
process.on("SIGTERM", cleanupAll);
