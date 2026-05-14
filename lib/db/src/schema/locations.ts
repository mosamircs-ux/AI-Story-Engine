import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { novels } from "./novels";

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  novelId: integer("novel_id").notNull().references(() => novels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  atmosphere: text("atmosphere"),
  category: text("category"),
  imageUrl: text("image_url"),
  appearsInChapters: text("appears_in_chapters").array(),
});

export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
