import { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { locations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router = Router();

const publicDir = "/tmp/novel-assets";
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

router.get("/novels/:novelId/locations", async (req, res) => {
  const novelId = Number(req.params.novelId);
  if (isNaN(novelId)) {
    res.status(400).json({ error: "Invalid novel ID" });
    return;
  }
  const locs = await db
    .select()
    .from(locations)
    .where(eq(locations.novelId, novelId))
    .orderBy(locations.name);
  res.json(locs);
});

router.post("/locations/:locationId/generate-image", async (req, res) => {
  const locationId = Number(req.params.locationId);
  if (isNaN(locationId)) {
    res.status(400).json({ error: "Invalid location ID" });
    return;
  }

  const [loc] = await db.select().from(locations).where(eq(locations.id, locationId));
  if (!loc) {
    res.status(404).json({ error: "Location not found" });
    return;
  }

  const category = loc.category || "place";
  const atmosphere = loc.atmosphere || "mysterious and cinematic";
  const prompt = `Cinematic wide-angle establishing shot of ${loc.name}, a ${category} in a novel. ${loc.description ?? ""} Atmosphere: ${atmosphere}. Epic fantasy illustration, dramatic lighting, detailed environment, no text, no people, 8K quality.`.trim();

  const imgBuffer = await generateImageBuffer(prompt, "1024x1024");
  const imgPath = path.join(publicDir, `loc-${locationId}.png`);
  fs.writeFileSync(imgPath, imgBuffer);
  const imageUrl = `/api/assets/loc-${locationId}.png`;

  const [updated] = await db
    .update(locations)
    .set({ imageUrl })
    .where(eq(locations.id, locationId))
    .returning();

  res.json(updated);
});

export default router;
