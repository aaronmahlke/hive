import { spawn, type ChildProcess } from "child_process";

const processes = new Map<
  string,
  { process: ChildProcess; type: "devserver" }
>();

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

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.on("exit", (code) => {
      resolve({ success: code === 0, output });
    });
    child.on("error", (err) => {
      resolve({ success: false, output: err.message });
    });
  });
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

export function cleanupAll(): void {
  for (const [key, entry] of processes) {
    console.log(`Cleaning up process: ${key}`);
    entry.process.kill("SIGTERM");
  }
  processes.clear();
}

process.on("SIGINT", cleanupAll);
process.on("SIGTERM", cleanupAll);
