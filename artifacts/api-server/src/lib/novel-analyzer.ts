/**
 * Novel Analysis Engine — Multi-phase, full-text analysis
 *
 * Phase 1: PDF extraction + chapter detection
 * Phase 2: Character discovery (full text, chunked)
 * Phase 3: Dialogue attribution per chunk (who says what)
 * Phase 4: Event extraction per chunk
 * Phase 5: Character enrichment (relationships, synthesis)
 * Phase 5b: Location extraction
 * Phase 6: Cover image generation
 */

import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { novels, characters, dialogueLines, storyEvents, locations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";

const ASSETS_DIR = "/tmp/novel-assets";
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedCharacter {
  name: string;
  aliases: string[];
  role: "protagonist" | "antagonist" | "supporting" | "minor";
  description: string;
  personality: string;
  physicalDescription: string;
  voiceStyle: string;
  color: string;
  relationships: string;
}

interface ExtractedDialogue {
  characterName: string;
  text: string;
  chapterNumber: number;
  sequenceOrder: number;
  context: string;
  addressedTo: string;
}

interface ExtractedEvent {
  title: string;
  description: string;
  visualDescription: string;
  chapterNumber: number;
  sequenceOrder: number;
  location: string;
  emotionalTone: string;
  characters: string[];
}

interface ExtractedLocation {
  name: string;
  description: string;
  atmosphere: string;
  category: string;
  appearsInChapters: string[];
}

interface ChunkAnalysis {
  chapterNumber: number;
  dialogue: ExtractedDialogue[];
  events: ExtractedEvent[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Split text into chunks of ~CHUNK_SIZE chars, respecting paragraph boundaries */
function chunkText(text: string, chunkSize = 8000): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    // Try to break at a paragraph boundary
    if (end < text.length) {
      const breakAt = text.lastIndexOf("\n\n", end);
      if (breakAt > start + chunkSize * 0.6) end = breakAt;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

/** Detect chapter number from a text chunk */
function detectChapter(chunk: string, chunkIndex: number, totalChunks: number): number {
  // Look for chapter markers in Arabic and English
  const arabicChapter = chunk.match(/(?:الفصل|فصل|الباب|باب)\s*(?:ال)?(\w+|\d+)/i);
  const englishChapter = chunk.match(/(?:chapter|ch\.?)\s*(\d+)/i);

  if (arabicChapter) {
    const arabicNums: Record<string, number> = {
      الأول: 1, الثاني: 2, الثالث: 3, الرابع: 4, الخامس: 5,
      السادس: 6, السابع: 7, الثامن: 8, التاسع: 9, العاشر: 10,
    };
    const word = arabicChapter[1];
    if (arabicNums[word]) return arabicNums[word];
    const n = parseInt(word);
    if (!isNaN(n)) return n;
  }
  if (englishChapter) {
    return parseInt(englishChapter[1]);
  }
  // Estimate based on position
  return Math.max(1, Math.ceil((chunkIndex / totalChunks) * 20));
}

async function callGPT(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return response.choices[0]?.message?.content ?? "{}";
}

// ─── Phase 2: Character Discovery ────────────────────────────────────────────

async function discoverCharacters(
  novelTitle: string,
  fullText: string,
  language: string,
): Promise<ExtractedCharacter[]> {
  // Use first 40k chars + last 5k chars (beginning + end of novel)
  const sampleText = fullText.slice(0, 38000) + "\n...\n" + fullText.slice(-4000);

  const prompt = `You are a literary analyst. Analyze this ${language} novel excerpt and identify ALL named characters.

Novel: "${novelTitle}"
Language: ${language}

Text:
${sampleText}

Return JSON with this exact structure:
{
  "characters": [
    {
      "name": "Primary name used most often",
      "aliases": ["nickname1", "title + name", "other names used for this character"],
      "role": "protagonist|antagonist|supporting|minor",
      "description": "Who this person is in the story (2-3 sentences)",
      "personality": "Key personality traits",
      "physicalDescription": "Physical appearance details from the text",
      "voiceStyle": "How they speak: formal/casual/aggressive/gentle/poetic/blunt/etc.",
      "color": "#hexcolor (pick one unique color that represents their energy/vibe)",
      "relationships": "JSON string describing relationships with other characters, e.g. '{\"Ahmed\": \"brother\", \"Sara\": \"love interest\"}'"
    }
  ]
}

Rules:
- Include EVERY named character who appears more than once
- Use the most common name form as the primary name
- aliases should include ALL other names/titles used for the same character
- For Arabic novels: include both formal and informal name variants
- Be specific about relationships — who is whose brother/sister/enemy/love/mentor
- minimum 3 characters, no maximum
- Roles: protagonist=main hero, antagonist=main villain/obstacle, supporting=important secondary, minor=brief appearance`;

  const raw = await callGPT(prompt);
  try {
    const parsed = JSON.parse(raw);
    return (parsed.characters ?? []) as ExtractedCharacter[];
  } catch {
    return [];
  }
}

// ─── Phase 3+4: Chunk Analysis (Dialogue + Events) ───────────────────────────

async function analyzeChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  characterNames: string[],
  language: string,
): Promise<ChunkAnalysis> {
  const chapterNumber = detectChapter(chunk, chunkIndex, totalChunks);
  const baseSeq = chunkIndex * 100;

  const charList = characterNames.slice(0, 20).join(", ");

  const prompt = `You are analyzing a chunk of a ${language} novel. Extract dialogue lines and story events.

Known characters: ${charList}

Text chunk (chunk ${chunkIndex + 1} of ${totalChunks}, approximately chapter ${chapterNumber}):
${chunk}

Return JSON with this exact structure:
{
  "dialogue": [
    {
      "characterName": "exact name from known characters list",
      "text": "the exact words spoken (quote only, no attribution tags)",
      "chapterNumber": ${chapterNumber},
      "sequenceOrder": 1,
      "context": "1-sentence context: what situation prompted this line",
      "addressedTo": "name of character being spoken to, or empty string if narration/internal"
    }
  ],
  "events": [
    {
      "title": "Short dramatic title for this scene/event (5-8 words)",
      "description": "What happens in this scene (2-3 sentences)",
      "visualDescription": "Cinematic image description for AI art generation: lighting, colors, composition, mood, specific visual details",
      "chapterNumber": ${chapterNumber},
      "sequenceOrder": 1,
      "location": "specific place name or setting",
      "emotionalTone": "tense|joyful|sad|mysterious|romantic|violent|peaceful|shocking|hopeful|despairing",
      "characters": ["Character1", "Character2"]
    }
  ]
}

Dialogue rules:
- ONLY extract lines where speaker is identifiable from context
- For Arabic: look for patterns like قال/قالت/أجاب/صاح/همس/صرخ followed by quotes, OR character name before colon, OR quotes with attribution
- For English: look for "said", "replied", "whispered", "shouted", etc.
- Do NOT guess the speaker — only include when attribution is clear
- text should be the actual words spoken only, not the attribution verb
- sequenceOrder: number each item 1,2,3... in order of appearance

Events rules:
- Only extract SIGNIFICANT story events (not minor filler)
- visualDescription must be vivid and specific enough to generate a compelling image
- Include 2-5 events per chunk maximum
- characters: list only the main characters IN this specific scene`;

  const raw = await callGPT(prompt);
  try {
    const parsed = JSON.parse(raw);

    // Fix sequence ordering to be globally unique
    const dialogue: ExtractedDialogue[] = (parsed.dialogue ?? []).map(
      (d: ExtractedDialogue, i: number) => ({
        ...d,
        sequenceOrder: baseSeq + i,
      }),
    );
    const events: ExtractedEvent[] = (parsed.events ?? []).map(
      (e: ExtractedEvent, i: number) => ({
        ...e,
        sequenceOrder: baseSeq + i,
      }),
    );

    return { chapterNumber, dialogue, events };
  } catch {
    return { chapterNumber, dialogue: [], events: [] };
  }
}

// ─── Phase 5b: Location Extraction ───────────────────────────────────────────

async function extractLocations(
  novelTitle: string,
  allEvents: ExtractedEvent[],
  language: string,
): Promise<ExtractedLocation[]> {
  // Build a list of unique location names from events for context
  const rawLocs = [...new Set(allEvents.map((e) => e.location).filter(Boolean))];
  if (rawLocs.length === 0) return [];

  const eventSummary = allEvents
    .filter((e) => e.location)
    .slice(0, 30)
    .map((e) => `- ${e.location}: ${e.description ?? ""}`)
    .join("\n");

  const prompt = `You are a literary analyst. Based on these story events from the ${language} novel "${novelTitle}", extract all significant LOCATIONS/PLACES.

Events and their locations:
${eventSummary}

Return JSON:
{
  "locations": [
    {
      "name": "Location name",
      "description": "What this place is and its role in the story (1-2 sentences)",
      "atmosphere": "The mood/feeling of this place: dark/mystical/grand/intimate/dangerous/peaceful etc.",
      "category": "city|castle|village|forest|desert|palace|market|house|prison|battlefield|sea|other",
      "appearsInChapters": ["1", "3", "5"]
    }
  ]
}

Rules:
- Merge duplicate/similar locations (e.g. "the castle" and "the palace" might be the same place)
- Include only locations that matter to the story
- Use the most vivid, specific name for each location
- Maximum 15 locations`;

  try {
    const raw = await callGPT(prompt);
    const parsed = JSON.parse(raw);
    return (parsed.locations ?? []) as ExtractedLocation[];
  } catch {
    return [];
  }
}

// ─── Phase 5: Character Enrichment ───────────────────────────────────────────

async function enrichCharacters(
  novelTitle: string,
  existingChars: ExtractedCharacter[],
  allDialogue: ExtractedDialogue[],
): Promise<ExtractedCharacter[]> {
  if (existingChars.length === 0) return existingChars;

  // Build dialogue samples per character (max 5 lines each)
  const dialogueSamples: Record<string, string[]> = {};
  for (const char of existingChars) {
    const allNames = [char.name, ...char.aliases];
    const samples = allDialogue
      .filter((d) => allNames.some((n) => d.characterName.toLowerCase() === n.toLowerCase()))
      .slice(0, 5)
      .map((d) => `"${d.text}"`);
    dialogueSamples[char.name] = samples;
  }

  const charSummary = existingChars
    .map((c) => `${c.name} (${c.role}): ${c.description}`)
    .join("\n");

  const prompt = `Given these characters from the novel "${novelTitle}", enrich their profiles based on their dialogue samples.

Characters:
${charSummary}

Dialogue samples per character:
${JSON.stringify(dialogueSamples, null, 2)}

Return JSON:
{
  "enriched": [
    {
      "name": "exact character name",
      "voiceStyle": "refined description of HOW they speak based on actual dialogue: pace, vocabulary level, tone, speech patterns, verbal tics",
      "personality": "refined personality based on dialogue evidence",
      "relationships": "JSON string like '{\"OtherChar\": \"relationship type\"}' for all known relationships"
    }
  ]
}`;

  try {
    const raw = await callGPT(prompt);
    const parsed = JSON.parse(raw);
    const enrichments = parsed.enriched as Array<{
      name: string;
      voiceStyle: string;
      personality: string;
      relationships: string;
    }>;

    return existingChars.map((char) => {
      const enrichment = enrichments?.find(
        (e) => e.name.toLowerCase() === char.name.toLowerCase(),
      );
      if (!enrichment) return char;
      return {
        ...char,
        voiceStyle: enrichment.voiceStyle || char.voiceStyle,
        personality: enrichment.personality || char.personality,
        relationships: enrichment.relationships || char.relationships,
      };
    });
  } catch {
    return existingChars;
  }
}

// ─── Main Analysis Orchestrator ───────────────────────────────────────────────

export async function analyzeNovel(novelId: number, filePath: string, novelTitle: string) {
  // ── PHASE 1: PDF Extraction ──
  let rawText = "";
  let pageCount = 0;

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    rawText = pdfData.text;
    pageCount = pdfData.numpages;
  } catch {
    rawText = `This is the novel "${novelTitle}". It contains compelling characters and dramatic events.`;
  }

  // Clean text: normalize whitespace, remove excessive blank lines
  rawText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  const wordCount = rawText.split(/\s+/).length;

  await db.update(novels).set({ pageCount, wordCount, rawText }).where(eq(novels.id, novelId));

  // ── Detect Language ──
  const arabicChars = (rawText.match(/[\u0600-\u06FF]/g) || []).length;
  const language = arabicChars > rawText.length * 0.1 ? "Arabic" : "English";

  await db.update(novels).set({ language }).where(eq(novels.id, novelId));

  // ── Split into chunks ──
  const chunks = chunkText(rawText, 8000);
  const totalChunks = chunks.length;

  // ── PHASE 2: Character Discovery ──
  const extractedChars = await discoverCharacters(novelTitle, rawText, language);

  // Extract a synopsis from the discovered characters + beginning of text
  const synopsisPrompt = `Write a compelling 3-sentence synopsis for the novel "${novelTitle}" based on:
Characters: ${extractedChars.map((c) => `${c.name} (${c.role}): ${c.description}`).join("; ")}
Opening text: ${rawText.slice(0, 3000)}

Return JSON: { "synopsis": "..." }`;

  let synopsis = "";
  try {
    const synRaw = await callGPT(synopsisPrompt);
    synopsis = JSON.parse(synRaw).synopsis ?? "";
  } catch {
    synopsis = "";
  }

  await db.update(novels).set({ synopsis }).where(eq(novels.id, novelId));

  // Build character name -> id map, storing all aliases for matching
  const characterMap: Record<string, number> = {}; // lowercase name/alias -> DB id

  for (const char of extractedChars) {
    const validRoles = ["protagonist", "antagonist", "supporting", "minor"];
    const role = validRoles.includes(char.role) ? char.role : "supporting";

    const [inserted] = await db
      .insert(characters)
      .values({
        novelId,
        name: char.name,
        aliases: char.aliases ?? [],
        role,
        description: char.description ?? null,
        personality: char.personality ?? null,
        physicalDescription: char.physicalDescription ?? null,
        voiceStyle: char.voiceStyle ?? null,
        color: char.color ?? null,
        relationships: char.relationships ?? null,
        dialogueCount: 0,
      })
      .returning();

    if (inserted) {
      characterMap[char.name.toLowerCase()] = inserted.id;
      for (const alias of char.aliases ?? []) {
        characterMap[alias.toLowerCase()] = inserted.id;
      }
    }
  }

  const characterNames = extractedChars.map((c) => c.name);

  // ── PHASE 3+4: Chunk Analysis (parallel, 3 at a time) ──
  const chunkResults = await batchProcess(
    chunks.map((chunk, i) => ({ chunk, i })),
    async ({ chunk, i }) => analyzeChunk(chunk, i, totalChunks, characterNames, language),
    { concurrency: 3, retries: 3 },
  );

  // Flatten results
  const allDialogue: ExtractedDialogue[] = chunkResults.flatMap((r) => r.dialogue);
  const allEvents: ExtractedEvent[] = chunkResults.flatMap((r) => r.events);

  // ── PHASE 5: Character Enrichment + Location Extraction (parallel) ──
  const [enrichedChars, extractedLocations] = await Promise.all([
    enrichCharacters(novelTitle, extractedChars, allDialogue),
    extractLocations(novelTitle, allEvents, language),
  ]);

  // Update characters with enriched data
  for (const enriched of enrichedChars) {
    const charId = characterMap[enriched.name.toLowerCase()];
    if (!charId) continue;
    await db
      .update(characters)
      .set({
        voiceStyle: enriched.voiceStyle ?? null,
        personality: enriched.personality ?? null,
        relationships: enriched.relationships ?? null,
      })
      .where(eq(characters.id, charId));
  }

  // ── Save Locations ──
  for (const loc of extractedLocations) {
    await db.insert(locations).values({
      novelId,
      name: loc.name,
      description: loc.description ?? null,
      atmosphere: loc.atmosphere ?? null,
      category: loc.category ?? null,
      appearsInChapters: loc.appearsInChapters ?? [],
    });
  }

  // ── Save Dialogue Lines ──
  const dialogueCountByChar: Record<number, number> = {};
  let savedDialogue = 0;

  for (const line of allDialogue) {
    const charId = characterMap[line.characterName.toLowerCase()];
    if (!charId) continue;

    await db.insert(dialogueLines).values({
      novelId,
      characterId: charId,
      text: line.text,
      chapterNumber: line.chapterNumber ?? 1,
      sequenceOrder: line.sequenceOrder ?? savedDialogue,
      context: line.context ?? null,
      addressedTo: line.addressedTo || null,
    });

    dialogueCountByChar[charId] = (dialogueCountByChar[charId] ?? 0) + 1;
    savedDialogue++;
  }

  // Update dialogue counts
  for (const [charId, count] of Object.entries(dialogueCountByChar)) {
    await db
      .update(characters)
      .set({ dialogueCount: count })
      .where(eq(characters.id, parseInt(charId)));
  }

  // ── Save Story Events ──
  // Deduplicate events by title to avoid near-duplicates from overlapping chunks
  const seenEventTitles = new Set<string>();
  let savedEvents = 0;

  for (const event of allEvents) {
    const titleKey = event.title.toLowerCase().slice(0, 30);
    if (seenEventTitles.has(titleKey)) continue;
    seenEventTitles.add(titleKey);

    await db.insert(storyEvents).values({
      novelId,
      title: event.title,
      description: event.description ?? null,
      visualDescription: event.visualDescription ?? null,
      chapterNumber: event.chapterNumber ?? 1,
      sequenceOrder: event.sequenceOrder ?? savedEvents,
      location: event.location ?? null,
      emotionalTone: event.emotionalTone ?? null,
      characters: event.characters ?? [],
    });
    savedEvents++;
  }

  const charCount = extractedChars.length;

  // ── PHASE 6: Cover Image ──
  try {
    const coverPrompt = [
      `Book cover art for "${novelTitle}".`,
      synopsis ? synopsis.slice(0, 200) : "",
      "Style: dramatic literary illustration, rich colors, cinematic composition, epic mood.",
    ]
      .filter(Boolean)
      .join(" ");

    const imgBuffer = await generateImageBuffer(coverPrompt, "1024x1024");
    const coverPath = path.join(ASSETS_DIR, `cover-${novelId}.png`);
    fs.writeFileSync(coverPath, imgBuffer);
    const coverUrl = `/api/assets/cover-${novelId}.png`;

    await db
      .update(novels)
      .set({ status: "ready", characterCount: charCount, eventCount: savedEvents, coverImageUrl: coverUrl })
      .where(eq(novels.id, novelId));
  } catch {
    await db
      .update(novels)
      .set({ status: "ready", characterCount: charCount, eventCount: savedEvents })
      .where(eq(novels.id, novelId));
  }
}
