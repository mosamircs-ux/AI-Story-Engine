import { Router } from "express";
import { db } from "@workspace/db";
import { characters } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListCharactersParams } from "@workspace/api-zod";

const router = Router();

router.get("/novels/:novelId/characters", async (req, res) => {
  const parsed = ListCharactersParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid novel ID" });
    return;
  }
  const chars = await db
    .select()
    .from(characters)
    .where(eq(characters.novelId, parsed.data.novelId))
    .orderBy(characters.dialogueCount);
  res.json(chars);
});

export default router;
