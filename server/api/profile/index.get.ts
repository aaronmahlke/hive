import { db } from "../../database";
import { devProfile } from "../../database/schema";

export default defineEventHandler(async () => {
  return db.select().from(devProfile);
});
