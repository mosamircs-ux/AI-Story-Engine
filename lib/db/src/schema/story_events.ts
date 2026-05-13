import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { novels } from "./novels";

export const storyEvents = pgTable("story_events", {
  id: serial("id").primaryKey(),
  novelId: integer("novel_id").notNull().references(() => novels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  chapterNumber: integer("chapter_number").notNull().default(1),
  location: text("location"),
  imageUrl: text("image_url"),
  characters: text("characters").array(),
  emotionalTone: text("emotional_tone"),
});

export const insertStoryEventSchema = createInsertSchema(storyEvents).omit({
  id: true,
});

export type StoryEvent = typeof storyEvents.$inferSelect;
export type InsertStoryEvent = z.infer<typeof insertStoryEventSchema>;
