import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const novels = pgTable("novels", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(),
  status: text("status").notNull().default("uploaded"),
  pageCount: integer("page_count"),
  wordCount: integer("word_count"),
  language: text("language"),
  synopsis: text("synopsis"),
  coverImageUrl: text("cover_image_url"),
  characterCount: integer("character_count"),
  eventCount: integer("event_count"),
  rawText: text("raw_text"),
  movieUrl: text("movie_url"),
  movieStatus: text("movie_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertNovelSchema = createInsertSchema(novels).omit({
  id: true,
  createdAt: true,
});

export type Novel = typeof novels.$inferSelect;
export type InsertNovel = z.infer<typeof insertNovelSchema>;
