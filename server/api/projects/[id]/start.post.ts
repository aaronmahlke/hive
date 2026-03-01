import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { allocatePort } from "../../../services/port-allocator";
import { startOpenCodeServer, isServerHealthy } from "../../../services/process";
import { parseConfig } from "../../../utils/parse-config";

/**
 * Start an OpenCode server for the main project directory.
 * Returns immediately if server is already healthy.
 * MCP registration happens in the background (non-blocking).
 */
export default defineEventHandler(async (event) => {
  const t0 = Date.now();
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: { id },
  });
  console.log(`[start] DB lookup: ${Date.now() - t0}ms`);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const config = parseConfig(project.configOverride);

  // Check if already running and healthy
  if (config.opencodePort) {
    const t1 = Date.now();
    if (await isServerHealthy(config.opencodePort)) {
      console.log(`[start] Already healthy on :${config.opencodePort}: ${Date.now() - t1}ms (total: ${Date.now() - t0}ms)`);
      return { port: config.opencodePort, alreadyRunning: true };
    }
    console.log(`[start] Port :${config.opencodePort} not healthy, restarting: ${Date.now() - t1}ms`);
  }

  const t2 = Date.now();
  const port = await allocatePort();
  console.log(`[start] Port allocated :${port}: ${Date.now() - t2}ms`);

  const pid = startOpenCodeServer(project.path, port);
  console.log(`[start] Spawned opencode (pid=${pid}) on :${port}`);

  // Store port immediately - don't wait for MCP registration
  await db
    .update(projects)
    .set({
      configOverride: { ...config, opencodePort: port, opencodePid: pid } as any,
    })
    .where(eq(projects.id, id));

  // Wait for server to be healthy before returning (max 10s)
  const maxWait = 10_000;
  const startTime = Date.now();
  let attempts = 0;
  while (Date.now() - startTime < maxWait) {
    attempts++;
    if (await isServerHealthy(port)) {
      console.log(`[start] Healthy after ${attempts} attempts, ${Date.now() - startTime}ms (total: ${Date.now() - t0}ms)`);
      return { port, pid, alreadyRunning: false };
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // Return anyway - the server might still be starting
  console.log(`[start] Gave up after ${attempts} attempts, ${Date.now() - startTime}ms (total: ${Date.now() - t0}ms)`);
  return { port, pid, alreadyRunning: false };
});
