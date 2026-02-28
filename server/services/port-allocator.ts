import { db } from "../database";
import { worktrees } from "../database/schema";
import { isNotNull } from "drizzle-orm";
import { createConnection } from "net";

const BASE_OPENCODE_PORT = 4100;

export async function allocatePort(): Promise<number> {
  // Get all currently used ports
  const used = await db
    .select({ port: worktrees.opencodePort })
    .from(worktrees)
    .where(isNotNull(worktrees.opencodePort));

  const usedPorts = new Set(used.map((r) => r.port).filter(Boolean));

  // Find the next available port starting from base
  let port = BASE_OPENCODE_PORT;
  while (usedPorts.has(port)) {
    port++;
  }

  // Verify the port is actually free on the system
  const isFree = await checkPortFree(port);
  if (!isFree) {
    // Try the next few ports
    for (let i = 1; i < 100; i++) {
      port++;
      if (!usedPorts.has(port) && (await checkPortFree(port))) {
        return port;
      }
    }
    throw new Error("Could not find a free port for OpenCode server");
  }

  return port;
}

function checkPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(200);
    socket.on("connect", () => {
      socket.destroy();
      resolve(false); // port is in use
    });
    socket.on("error", () => {
      resolve(true); // port is free
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(true); // port is free
    });
  });
}
