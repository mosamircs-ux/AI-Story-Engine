import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { novels } from "./novels";

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  novelId: integer("novel_id").notNull().references(() => novels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull().default("supporting"),
  description: text("description"),
  personality: text("personality"),
  physicalDescription: text("physical_description"),
  imageUrl: text("image_url"),
  voiceStyle: text("voice_style"),
  dialogueCount: integer("dialogue_count").default(0),
  color: text("color"),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
});

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
