import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { novels } from "./novels";
import { characters } from "./characters";

export const dialogueLines = pgTable("dialogue_lines", {
  id: serial("id").primaryKey(),
  novelId: integer("novel_id").notNull().references(() => novels.id, { onDelete: "cascade" }),
  characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  chapterNumber: integer("chapter_number").notNull().default(1),
  pageNumber: integer("page_number"),
  audioUrl: text("audio_url"),
  context: text("context"),
});

export const insertDialogueLineSchema = createInsertSchema(dialogueLines).omit({
  id: true,
});

export type DialogueLine = typeof dialogueLines.$inferSelect;
export type InsertDialogueLine = z.infer<typeof insertDialogueLineSchema>;
