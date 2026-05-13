# Novel World

A web app that transforms any uploaded novel PDF into a living, interactive world — with AI-extracted characters, generated portraits, text-to-speech dialogue, and cinematic scene images.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/novel-world run dev` — run the frontend (port 23698)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI Integration for OpenAI

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: OpenAI via Replit AI Integrations (gpt-5.4 for analysis, gpt-image-1 for portraits/scenes, TTS for dialogue)
- PDF parsing: pdf-parse
- File uploads: multer
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — DB schema: novels, characters, dialogue_lines, story_events, conversations, messages
- `artifacts/api-server/src/routes/` — Backend routes: novels.ts, characters.ts, characters-list.ts, events.ts
- `artifacts/novel-world/src/pages/` — Frontend pages
- `/tmp/novel-uploads/` — uploaded PDF files (runtime)
- `/tmp/novel-assets/` — generated images and audio files (runtime)
- `/api/assets/*` — static asset serving for generated images/audio

## Architecture decisions

- Analysis is triggered manually (not on upload) so users can see the uploaded novel first
- Analysis runs asynchronously — status polling on the frontend every 3s while status = "analyzing"
- Generated assets (images, audio) stored in /tmp and served via /api/assets static route
- Character voices are assigned by characterId % 6 to pick from 6 OpenAI TTS voices
- All dialogue, characters, events are extracted in one GPT call to minimize API usage

## Product

Upload any novel PDF → the app extracts characters with roles, personality, and dialogue → generates AI portrait images for each character → converts their dialogue lines to distinct voice TTS audio → generates cinematic scene images for story events → lets you explore the whole story in an immersive, dark cinematic UI.

## User preferences

- Arabic-first audience but app supports any language novel
- Cinematic, dark, editorial aesthetic

## Gotchas

- pdf-parse can fail on some PDFs; the novel analysis falls back to a placeholder text if parsing fails
- OpenAI image generation with gpt-image-1 only supports: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing openapi.yaml before working on routes or frontend
- DB assets are in /tmp — they don't persist across server restarts in production; use object storage for production

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.local/skills/ai-integrations-openai/SKILL.md` for OpenAI integration details
