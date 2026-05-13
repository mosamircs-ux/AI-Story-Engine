import { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { storyEvents, characters } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListEventsParams,
  GenerateEventImageParams,
} from "@workspace/api-zod";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router = Router();

const publicDir = "/tmp/novel-assets";
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

router.get("/novels/:novelId/events", async (req, res) => {
  const parsed = ListEventsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid novel ID" });
    return;
  }
  const events = await db
    .select()
    .from(storyEvents)
    .where(eq(storyEvents.novelId, parsed.data.novelId))
    .orderBy(storyEvents.chapterNumber);
  res.json(events);
});

router.post("/events/:eventId/generate-image", async (req, res) => {
  const parsed = GenerateEventImageParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid event ID" });
    return;
  }
  const { eventId } = parsed.data;
  const [event] = await db.select().from(storyEvents).where(eq(storyEvents.id, eventId));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const charNames = (event.characters ?? []).join(", ");
  const prompt = `Scene from a novel: "${event.title}". ${event.description ?? ""}. Location: ${event.location ?? "unknown"}. Characters: ${charNames}. Emotional tone: ${event.emotionalTone ?? "dramatic"}. Cinematic, painterly illustration style, literary fiction book art.`.trim();

  const imgBuffer = await generateImageBuffer(prompt, "1024x1024");
  const imgPath = path.join(publicDir, `event-${eventId}.png`);
  fs.writeFileSync(imgPath, imgBuffer);
  const imageUrl = `/api/assets/event-${eventId}.png`;

  const [updated] = await db
    .update(storyEvents)
    .set({ imageUrl })
    .where(eq(storyEvents.id, eventId))
    .returning();

  res.json(updated);
});

export default router;
