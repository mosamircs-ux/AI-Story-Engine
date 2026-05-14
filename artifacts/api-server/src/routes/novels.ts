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
import { analyzeNovel } from "../lib/novel-analyzer";

const router = Router();

const uploadDir = "/tmp/novel-uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
  const recentEvents = events
    .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0))
    .slice(0, 5);

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
  // Clear any previous analysis data (re-analysis support)
  await db.delete(characters).where(eq(characters.novelId, novelId));
  await db.delete(storyEvents).where(eq(storyEvents.novelId, novelId));
  await db.delete(dialogueLines).where(eq(dialogueLines.novelId, novelId));
  await db.update(novels).set({ status: "analyzing" }).where(eq(novels.id, novelId));

  const updatedNovel = { ...novel, status: "analyzing" };
  res.json(updatedNovel);

  // Run full multi-phase analysis asynchronously
  analyzeNovel(novelId, novel.filePath, novel.title).catch((err) => {
    req.log.error({ err }, "Novel analysis failed");
    db.update(novels).set({ status: "error" }).where(eq(novels.id, novelId)).catch(() => {});
  });
});

export default router;
