/**
 * Movie Composer — builds an MP4 from scene images + dialogue audio using ffmpeg.
 *
 * Pipeline:
 *  1. Load events (sorted by chapter+sequence) and dialogue lines (with audio)
 *  2. Write a concat image list → silent slideshow
 *  3. Concatenate audio files per chapter → single audio track
 *  4. Mix video + audio → final MP4
 *  5. Update novel.movieUrl + movieStatus in DB
 */

import { Router } from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { db } from "@workspace/db";
import { novels, storyEvents, dialogueLines } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();
const ASSETS = "/tmp/novel-assets";
const TMP = "/tmp/novel-movie-tmp";

if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

// ─── ffmpeg helper ────────────────────────────────────────────────────────────

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args], { stdio: "pipe" });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

// ─── Per-scene clip builder ───────────────────────────────────────────────────

/** Create a silent video clip for one scene image (8 s at 25 fps). */
async function makeImageClip(imagePath: string, outPath: string): Promise<void> {
  await runFFmpeg([
    "-loop", "1",
    "-i", imagePath,
    "-t", "8",
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-r", "25",
    outPath,
  ]);
}

/** Concatenate multiple MP3 audio files into one. */
async function concatAudio(audioPaths: string[], outPath: string): Promise<void> {
  const listPath = outPath + ".lst";
  fs.writeFileSync(listPath, audioPaths.map(p => `file '${p}'`).join("\n"));
  await runFFmpeg([
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-c", "copy",
    outPath,
  ]);
  fs.unlinkSync(listPath);
}

/** Concatenate video clips. */
async function concatVideo(clipPaths: string[], outPath: string): Promise<void> {
  const listPath = outPath + ".lst";
  fs.writeFileSync(listPath, clipPaths.map(p => `file '${p}'`).join("\n"));
  await runFFmpeg([
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-c", "copy",
    outPath,
  ]);
  fs.unlinkSync(listPath);
}

/** Mix video track with audio track into final MP4. */
async function mixVideoAudio(videoPath: string, audioPath: string, outPath: string): Promise<void> {
  await runFFmpeg([
    "-i", videoPath,
    "-i", audioPath,
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    outPath,
  ]);
}

// ─── Background composition job ───────────────────────────────────────────────

const inProgress = new Set<number>();

async function composeMovieJob(novelId: number): Promise<void> {
  const jobTmp = path.join(TMP, `novel-${novelId}`);
  fs.mkdirSync(jobTmp, { recursive: true });

  try {
    // 1. Load events
    const events = await db
      .select()
      .from(storyEvents)
      .where(eq(storyEvents.novelId, novelId))
      .orderBy(asc(storyEvents.chapterNumber), asc(storyEvents.sequenceOrder));

    const eventsWithImages = events.filter(e => e.imageUrl);

    if (eventsWithImages.length === 0) {
      await db.update(novels)
        .set({ movieStatus: "error", movieUrl: null })
        .where(eq(novels.id, novelId));
      return;
    }

    // 2. Build per-scene clips
    const clipPaths: string[] = [];
    for (let i = 0; i < eventsWithImages.length; i++) {
      const event = eventsWithImages[i];
      // imageUrl is like /api/assets/event-123.png → map to disk
      const imageDisk = path.join(ASSETS, path.basename(event.imageUrl!));
      if (!fs.existsSync(imageDisk)) continue;

      const clipPath = path.join(jobTmp, `clip-${i}.mp4`);
      await makeImageClip(imageDisk, clipPath);
      clipPaths.push(clipPath);
    }

    if (clipPaths.length === 0) {
      await db.update(novels)
        .set({ movieStatus: "error", movieUrl: null })
        .where(eq(novels.id, novelId));
      return;
    }

    // 3. Concatenate clips into silent video
    const silentVideo = path.join(jobTmp, "silent.mp4");
    if (clipPaths.length === 1) {
      fs.copyFileSync(clipPaths[0], silentVideo);
    } else {
      await concatVideo(clipPaths, silentVideo);
    }

    // 4. Build audio track from dialogue lines
    const lines = await db
      .select()
      .from(dialogueLines)
      .where(eq(dialogueLines.novelId, novelId))
      .orderBy(asc(dialogueLines.chapterNumber), asc(dialogueLines.sequenceOrder));

    const audioPaths = lines
      .filter(l => l.audioUrl)
      .map(l => path.join(ASSETS, path.basename(l.audioUrl!)))
      .filter(p => fs.existsSync(p));

    let finalVideo = silentVideo;

    if (audioPaths.length > 0) {
      const combinedAudio = path.join(jobTmp, "audio.mp3");
      await concatAudio(audioPaths, combinedAudio);

      const mixedVideo = path.join(jobTmp, "mixed.mp4");
      await mixVideoAudio(silentVideo, combinedAudio, mixedVideo);
      finalVideo = mixedVideo;
    }

    // 5. Move to final location
    const outPath = path.join(ASSETS, `movie-${novelId}.mp4`);
    fs.copyFileSync(finalVideo, outPath);

    const movieUrl = `/api/assets/movie-${novelId}.mp4`;
    await db.update(novels)
      .set({ movieUrl, movieStatus: "ready" })
      .where(eq(novels.id, novelId));

  } catch (err) {
    await db.update(novels)
      .set({ movieStatus: "error", movieUrl: null })
      .where(eq(novels.id, novelId));
    throw err;
  } finally {
    inProgress.delete(novelId);
    // Cleanup tmp
    try { fs.rmSync(jobTmp, { recursive: true, force: true }); } catch {}
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post("/novels/:novelId/compose-movie", async (req, res) => {
  const novelId = Number(req.params.novelId);
  if (isNaN(novelId)) { res.status(400).json({ error: "Invalid novel ID" }); return; }

  const [novel] = await db.select().from(novels).where(eq(novels.id, novelId));
  if (!novel) { res.status(404).json({ error: "Novel not found" }); return; }

  // Return existing movie if already ready
  if (novel.movieStatus === "ready" && novel.movieUrl) {
    res.json(novel);
    return;
  }

  // Don't double-start
  if (inProgress.has(novelId) || novel.movieStatus === "processing") {
    res.json({ ...novel, movieStatus: "processing" });
    return;
  }

  // Mark as processing and start background job
  inProgress.add(novelId);
  await db.update(novels)
    .set({ movieStatus: "processing", movieUrl: null })
    .where(eq(novels.id, novelId));

  const [updated] = await db.select().from(novels).where(eq(novels.id, novelId));

  // Fire and forget
  composeMovieJob(novelId).catch((err) => {
    req.log.error({ err }, "Movie composition failed");
  });

  res.json(updated);
});

export default router;
