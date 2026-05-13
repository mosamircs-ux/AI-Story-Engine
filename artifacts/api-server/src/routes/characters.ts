import { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { characters, dialogueLines } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetCharacterParams,
  GenerateCharacterImageParams,
  ListCharacterLinesParams,
  GenerateLineAudioParams,
} from "@workspace/api-zod";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

const publicDir = "/tmp/novel-assets";
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

router.get("/characters/:characterId", async (req, res) => {
  const parsed = GetCharacterParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid character ID" });
    return;
  }
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, parsed.data.characterId));
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

router.post("/characters/:characterId/generate-image", async (req, res) => {
  const parsed = GenerateCharacterImageParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid character ID" });
    return;
  }
  const { characterId } = parsed.data;
  const [character] = await db.select().from(characters).where(eq(characters.id, characterId));
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  const prompt = `Portrait of ${character.name}, a ${character.role} character. ${character.physicalDescription ?? ""} ${character.personality ?? ""}. Literary illustration style, dramatic lighting, detailed face, book character art.`.trim();

  const imgBuffer = await generateImageBuffer(prompt, "1024x1024");
  const imgPath = path.join(publicDir, `char-${characterId}.png`);
  fs.writeFileSync(imgPath, imgBuffer);
  const imageUrl = `/api/assets/char-${characterId}.png`;

  const [updated] = await db
    .update(characters)
    .set({ imageUrl })
    .where(eq(characters.id, characterId))
    .returning();

  res.json(updated);
});

router.get("/characters/:characterId/lines", async (req, res) => {
  const parsed = ListCharacterLinesParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid character ID" });
    return;
  }
  const lines = await db
    .select()
    .from(dialogueLines)
    .where(eq(dialogueLines.characterId, parsed.data.characterId))
    .orderBy(dialogueLines.chapterNumber);
  res.json(lines);
});

router.post("/dialogue/:lineId/generate-audio", async (req, res) => {
  const parsed = GenerateLineAudioParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid line ID" });
    return;
  }
  const lineId = parsed.data.lineId;

  const [line] = await db.select().from(dialogueLines).where(eq(dialogueLines.id, lineId));
  if (!line) {
    res.status(404).json({ error: "Dialogue line not found" });
    return;
  }

  const [character] = await db.select().from(characters).where(eq(characters.id, line.characterId));

  // Choose voice based on character role or gender cues
  const voices: Array<"alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = [
    "alloy", "echo", "fable", "onyx", "nova", "shimmer",
  ];
  const voiceIndex = line.characterId % voices.length;
  const voice = voices[voiceIndex];

  const audioBuffer = await textToSpeech(line.text, voice);
  const audioPath = path.join(publicDir, `audio-${lineId}.mp3`);
  fs.writeFileSync(audioPath, audioBuffer);
  const audioUrl = `/api/assets/audio-${lineId}.mp3`;

  const [updated] = await db
    .update(dialogueLines)
    .set({ audioUrl })
    .where(eq(dialogueLines.id, lineId))
    .returning();

  res.json(updated);
});

export default router;
