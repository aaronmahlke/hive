import { defineConfig } from "drizzle-kit";
import { join } from "path";

export default defineConfig({
  schema: "./server/database/schema.ts",
  out: "./server/database/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: join(
      process.env.HOME || process.env.USERPROFILE || ".",
      ".local",
      "share",
      "hive",
      "hive.db",
    ),
  },
});
