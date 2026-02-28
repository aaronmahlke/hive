import { db } from "../../database";
import { projects } from "../../database/schema";
import { desc } from "drizzle-orm";

export default defineEventHandler(async () => {
  return db.select().from(projects).orderBy(desc(projects.createdAt));
});
