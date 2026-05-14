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

type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

function pickVoice(character: { role: string | null; personality: string | null; name: string; voiceStyle: string | null } | undefined): TTSVoice {
  if (!character) return "alloy";

  const role = character.role ?? "";
  const personality = (character.personality ?? "").toLowerCase();
  const voiceStyle = (character.voiceStyle ?? "").toLowerCase();
  const name = character.name.toLowerCase();

  // Detect female cues
  const femaleCues = ["she", "her", "female", "woman", "girl", "lady", "queen", "princess", "mother", "sister", "aunt", "wife",
    "هي", "امرأة", "فتاة", "ملكة", "أميرة", "أم", "أخت"];
  const isFemale = femaleCues.some(cue => personality.includes(cue) || voiceStyle.includes(cue) || name.includes(cue));

  if (isFemale) {
    // shimmer = warm/soft, nova = confident/clear
    const isGentle = ["gentle", "soft", "warm", "kind", "shy", "quiet", "هادئة", "رقيقة"].some(c => personality.includes(c) || voiceStyle.includes(c));
    return isGentle ? "shimmer" : "nova";
  }

  // Male voices
  if (role === "antagonist") return "onyx"; // deep, authoritative
  if (role === "protagonist") {
    const isIntense = ["intense", "serious", "determined", "bold", "جاد", "حازم", "قوي"].some(c => personality.includes(c) || voiceStyle.includes(c));
    return isIntense ? "echo" : "alloy";
  }
  if (role === "supporting") {
    const isWise = ["wise", "old", "elder", "mentor", "حكيم", "عجوز", "شيخ"].some(c => personality.includes(c) || name.includes(c));
    return isWise ? "fable" : "echo";
  }

  // Minor or unknown — deterministic fallback
  const voices: TTSVoice[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
  return voices[Math.abs(character.name.charCodeAt(0) ?? 0) % voices.length];
}

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

  // Pick voice based on role, personality, and gender cues in name/description
  const voice = pickVoice(character);

  const audioBuffer = await textToSpeech(line.text, voice, "mp3");
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
