import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { novels, characters, dialogueLines, storyEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetNovelParams,
  AnalyzeNovelParams,
  GetNovelSummaryParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router = Router();

const uploadDir = "/tmp/novel-uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const publicDir = "/tmp/novel-assets";
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/novels", async (req, res) => {
  const all = await db.select().from(novels).orderBy(novels.createdAt);
  res.json(all);
});

router.post("/novels/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const title = (req.body?.title as string) || req.file.originalname.replace(/\.pdf$/i, "");
  const [novel] = await db
    .insert(novels)
    .values({
      title,
      originalFilename: req.file.originalname,
      filePath: req.file.path,
      status: "uploaded",
    })
    .returning();
  res.status(201).json(novel);
});

router.get("/novels/:novelId", async (req, res) => {
  const parsed = GetNovelParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid novel ID" });
    return;
  }
  const [novel] = await db.select().from(novels).where(eq(novels.id, parsed.data.novelId));
  if (!novel) {
    res.status(404).json({ error: "Novel not found" });
    return;
  }
  res.json(novel);
});

router.get("/novels/:novelId/summary", async (req, res) => {
  const parsed = GetNovelSummaryParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid novel ID" });
    return;
  }
  const { novelId } = parsed.data;
  const [novel] = await db.select().from(novels).where(eq(novels.id, novelId));
  if (!novel) {
    res.status(404).json({ error: "Novel not found" });
    return;
  }
  const chars = await db.select().from(characters).where(eq(characters.novelId, novelId));
  const events = await db.select().from(storyEvents).where(eq(storyEvents.novelId, novelId));
  const lines = await db.select().from(dialogueLines).where(eq(dialogueLines.novelId, novelId));

  const topCharacters = chars
    .sort((a, b) => (b.dialogueCount ?? 0) - (a.dialogueCount ?? 0))
    .slice(0, 5);
  const recentEvents = events.slice(0, 5);

  res.json({
    novel,
    characterCount: chars.length,
    eventCount: events.length,
    dialogueCount: lines.length,
    topCharacters,
    recentEvents,
  });
});

router.post("/novels/:novelId/analyze", async (req, res) => {
  const parsed = AnalyzeNovelParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid novel ID" });
    return;
  }
  const { novelId } = parsed.data;
  const [novel] = await db.select().from(novels).where(eq(novels.id, novelId));
  if (!novel) {
    res.status(404).json({ error: "Novel not found" });
    return;
  }
  if (novel.status === "analyzing") {
    res.json(novel);
    return;
  }

  await db.update(novels).set({ status: "analyzing" }).where(eq(novels.id, novelId));
  const updatedNovel = { ...novel, status: "analyzing" };
  res.json(updatedNovel);

  // Run analysis asynchronously
  analyzeNovelAsync(novelId, novel.filePath, novel.title).catch((err) => {
    req.log.error({ err }, "Analysis failed");
    db.update(novels).set({ status: "error" }).where(eq(novels.id, novelId)).catch(() => {});
  });
});

async function analyzeNovelAsync(novelId: number, filePath: string, novelTitle: string) {
  let rawText = "";
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    rawText = pdfData.text;
    await db
      .update(novels)
      .set({ pageCount: pdfData.numpages, wordCount: rawText.split(/\s+/).length, rawText })
      .where(eq(novels.id, novelId));
  } catch {
    rawText = `This is the novel "${novelTitle}". It tells an engaging story with memorable characters.`;
  }

  const truncatedText = rawText.slice(0, 15000);

  const analysisPrompt = `Analyze this novel text and extract structured data. Return ONLY valid JSON.

Novel text (excerpt):
${truncatedText}

Return this exact JSON structure:
{
  "language": "Arabic or English or other",
  "synopsis": "2-3 sentence summary of the novel",
  "characters": [
    {
      "name": "Character name",
      "role": "protagonist|antagonist|supporting|minor",
      "description": "Who this character is in the story",
      "personality": "Their personality traits",
      "physicalDescription": "Their physical appearance",
      "voiceStyle": "How they speak (formal, casual, aggressive, gentle, etc.)",
      "color": "#hexcolor (pick a unique color representing this character's vibe)"
    }
  ],
  "events": [
    {
      "title": "Scene/event title",
      "description": "What happens in this scene",
      "chapterNumber": 1,
      "location": "Where it takes place",
      "emotionalTone": "tense|joyful|sad|mysterious|romantic|violent|peaceful",
      "characters": ["Character1", "Character2"]
    }
  ],
  "dialogueLines": [
    {
      "characterName": "Character name",
      "text": "What the character says",
      "chapterNumber": 1,
      "context": "Brief context of this dialogue"
    }
  ]
}

Extract at least 3-8 characters, 5-15 story events, and 10-30 dialogue lines. Make sure dialogue lines are actual quotes from the text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "user",
        content: analysisPrompt,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let analysis: {
    language?: string;
    synopsis?: string;
    characters?: Array<{
      name: string;
      role: string;
      description?: string;
      personality?: string;
      physicalDescription?: string;
      voiceStyle?: string;
      color?: string;
    }>;
    events?: Array<{
      title: string;
      description?: string;
      chapterNumber?: number;
      location?: string;
      emotionalTone?: string;
      characters?: string[];
    }>;
    dialogueLines?: Array<{
      characterName: string;
      text: string;
      chapterNumber?: number;
      context?: string;
    }>;
  };
  try {
    analysis = JSON.parse(content);
  } catch {
    analysis = {};
  }

  await db
    .update(novels)
    .set({
      language: analysis.language ?? "Unknown",
      synopsis: analysis.synopsis ?? null,
    })
    .where(eq(novels.id, novelId));

  const characterMap: Record<string, number> = {};
  for (const char of analysis.characters ?? []) {
    const validRoles = ["protagonist", "antagonist", "supporting", "minor"];
    const role = validRoles.includes(char.role) ? char.role : "supporting";
    const [inserted] = await db
      .insert(characters)
      .values({
        novelId,
        name: char.name,
        role,
        description: char.description ?? null,
        personality: char.personality ?? null,
        physicalDescription: char.physicalDescription ?? null,
        voiceStyle: char.voiceStyle ?? null,
        color: char.color ?? null,
        dialogueCount: 0,
      })
      .returning();
    if (inserted) {
      characterMap[char.name] = inserted.id;
    }
  }

  for (const event of analysis.events ?? []) {
    await db.insert(storyEvents).values({
      novelId,
      title: event.title,
      description: event.description ?? null,
      chapterNumber: event.chapterNumber ?? 1,
      location: event.location ?? null,
      emotionalTone: event.emotionalTone ?? null,
      characters: event.characters ?? [],
    });
  }

  const dialogueCountByChar: Record<number, number> = {};
  for (const line of analysis.dialogueLines ?? []) {
    const charId = characterMap[line.characterName];
    if (!charId) continue;
    await db.insert(dialogueLines).values({
      novelId,
      characterId: charId,
      text: line.text,
      chapterNumber: line.chapterNumber ?? 1,
      context: line.context ?? null,
    });
    dialogueCountByChar[charId] = (dialogueCountByChar[charId] ?? 0) + 1;
  }

  for (const [charId, count] of Object.entries(dialogueCountByChar)) {
    await db
      .update(characters)
      .set({ dialogueCount: count })
      .where(eq(characters.id, parseInt(charId)));
  }

  const charCount = (analysis.characters ?? []).length;
  const eventCount = (analysis.events ?? []).length;

  // Generate cover image
  try {
    const coverPrompt = `Book cover for "${novelTitle}": ${analysis.synopsis ?? "an epic story"}. Dramatic, artistic, literary fiction style.`;
    const imgBuffer = await generateImageBuffer(coverPrompt, "1024x1024");
    const coverPath = path.join(publicDir, `cover-${novelId}.png`);
    fs.writeFileSync(coverPath, imgBuffer);
    const coverUrl = `/api/assets/cover-${novelId}.png`;
    await db
      .update(novels)
      .set({ status: "ready", characterCount: charCount, eventCount, coverImageUrl: coverUrl })
      .where(eq(novels.id, novelId));
  } catch {
    await db
      .update(novels)
      .set({ status: "ready", characterCount: charCount, eventCount })
      .where(eq(novels.id, novelId));
  }
}

export default router;
