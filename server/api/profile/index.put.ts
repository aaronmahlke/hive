import { db } from "../../database";
import { devProfile } from "../../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    entries: {
      id?: string;
      key: string;
      value: string;
      category: "style" | "preference" | "convention" | "rule";
    }[];
  }>(event);

  if (!body.entries) {
    throw createError({ statusCode: 400, message: "entries are required" });
  }

  // Upsert each entry
  for (const entry of body.entries) {
    if (entry.id) {
      await db
        .update(devProfile)
        .set({ key: entry.key, value: entry.value, category: entry.category })
        .where(eq(devProfile.id, entry.id));
    } else {
      await db.insert(devProfile).values({
        id: nanoid(),
        key: entry.key,
        value: entry.value,
        category: entry.category,
      });
    }
  }

  return db.select().from(devProfile);
});
