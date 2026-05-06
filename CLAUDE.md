# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive touch-screen kiosk web application that visualizes research connections between academic papers from Universidad de Caldas departments. PDFs are uploaded, processed by AI, and their interdisciplinary relationships are rendered as a living, animated force-directed knowledge graph.

The full technical spec lives in [MASTER_PROMPT_KnowledgeGraph_UCaldas.md](MASTER_PROMPT_KnowledgeGraph_UCaldas.md) — consult it for database schemas, API prompt templates, component specs, and the development roadmap.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Next.js on localhost:3000
npm run build        # Production build
npm run start        # Production server
npm run worker       # Start BullMQ worker (separate Railway process)
npm run lint         # ESLint
```

Single test: `npx jest <test-file-path> --testNamePattern="<test name>"`

## Architecture: Three-Layer System

```
Layer 3: KIOSKO (Vercel) — Next.js 14 App Router
  ├─ / (public) — Knowledge Graph Canvas (touch-screen, portrait 9:16)
  └─ /admin     — Upload PDFs, approve relations, query wiki, lint

Layer 2: WIKI OF KNOWLEDGE (Supabase PostgreSQL + pgvector)
  ├─ papers          — metadata, extracted text, embeddings, processing status
  ├─ relations       — approved paper↔paper connections (AI-proposed, admin-approved)
  ├─ concept_nodes   — accumulated knowledge synthesis (the wiki itself)
  ├─ paper_concepts  — many-to-many: papers ↔ concept_nodes
  └─ wiki_log        — append-only audit trail

Layer 1: RAW SOURCES (Supabase Storage)
  └─ Private PDF bucket — immutable source of truth, never modified
```

**Critical design principle:** This is an **accumulative wiki**, NOT a RAG system. `concept_nodes` accumulate synthesized knowledge across multiple papers over time. Relations are explicitly curated (AI proposes → admin approves). The graph represents the curated knowledge layer, not just paper metadata.

## PDF Processing Pipeline (Railway Worker via BullMQ)

7 sequential steps per paper, each updating `processing_jobs.progress`:

1. `extract-text` — pdf-parse → `papers.full_text` (10%)
2. `generate-embedding` — GitHub Models `text-embedding-3-small` → `papers.embedding` vector[1536] (50%)
3. `extract-concepts` — OpenRouter LLM → methods/themes/keywords JSON (30%)
4. `update-wiki` — OpenRouter deepseek-r1 integrates concepts into `concept_nodes` (65%)
5. `find-relations` — pgvector similarity search (embeddings + concepts) → candidate relations (80%)
6. `explain-relations` — OpenRouter generates ES/EN explanations per relation (92%)
7. `notify` — insert into `wiki_log` + Supabase Realtime broadcast (100%)

Progress is displayed live on the kiosk via Supabase Realtime WebSocket subscription.

## AI Provider Strategy

Primary hub: **OpenRouter** (20 req/min, free tier).

| Task | Model |
|------|-------|
| Wiki updates (complex reasoning) | `deepseek/deepseek-r1:free` |
| Concept extraction, relation explanation | `meta-llama/llama-3.3-70b-instruct:free` |
| Slugs, classification (fast) | `meta-llama/llama-3.2-3b-instruct:free` |
| Embeddings | GitHub Models `text-embedding-3-small` |

Fallback chain: Cerebras → Groq → Scaleway (all share OpenAI SDK interface, swap `baseURL`).

## Key API Routes

All under `src/app/api/`:

| Route | Purpose |
|-------|---------|
| `POST /api/upload` | Receive PDF, store in Supabase Storage, enqueue BullMQ job |
| `GET/POST /api/papers` | List papers / create paper record |
| `GET /api/relations` | Get proposed relations awaiting approval |
| `POST /api/relations/[id]/approve` | Admin approves → triggers Realtime broadcast |
| `POST /api/relations/[id]/reject` | Admin rejects |
| `GET/PUT/DELETE /api/concepts/[slug]` | CRUD on concept_nodes |
| `POST /api/wiki/query` | Semantic search over accumulated wiki |
| `POST /api/wiki/lint` | Run wiki health diagnostic |
| `GET /api/wiki/log` | Activity history |

## Frontend Graph Visualization

- **Library:** `react-force-graph-2d` (WebGL, D3-force physics)
- **Node types:** Paper nodes (circles) + Concept nodes (hexagons), colored by department
- **Edges:** Approved relations, weight = similarity score
- **Interactions:** Tap node → detail modal, pinch → zoom, drag → pan
- **Mycelium animation:** On new approved relation → particle effects along bezier curves with glow, triggered via Supabase Realtime

## UI Constraints

- **Orientation:** Portrait 9:16, ~1080×1920px
- **Touch targets:** 44×44px minimum
- **Theme:** Bioluminescent dark background with glowing department colors
- **Language:** Spanish primary, English toggle
- **Design system:** Tailwind CSS + shadcn/ui + Framer Motion

## Technology Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 14+ App Router + TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui |
| Animations | Framer Motion |
| Graph | react-force-graph-2d |
| Database | Supabase PostgreSQL 15 + pgvector |
| Storage | Supabase Storage (private bucket) |
| Realtime | Supabase Realtime (WebSocket) |
| Worker queue | BullMQ + Redis |
| Worker host | Railway (separate service) |
| Frontend host | Vercel |

## Environment Variables

Required in `.env.local` (see master spec for full list of 28 variables):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
GITHUB_TOKEN           # for GitHub Models embeddings
REDIS_URL              # for BullMQ worker
ADMIN_PIN              # admin panel access
SIMILARITY_THRESHOLD   # e.g. 0.75
```

## Supabase Setup Notes

- Enable **pgvector** extension in Supabase dashboard before running migrations
- Enable **Replication** on: `relations`, `processing_jobs`, `concept_nodes` tables (required for Realtime)
- Migrations live in `supabase/migrations/`
- Full step-by-step instructions: `scripts/setup-supabase.md`

## Deployment

- **Frontend (Vercel):** `vercel.json` at root — secrets mapped via `@secret-name` convention
- **Worker (Railway):** `worker/railway.toml` — starts with `npm run worker`, auto-restarts on failure
- **GitHub repo:** https://github.com/dcbarco/ucaldas-knowledge-graph

## Architecture Decisions & Conventions

### AI Client Lazy Initialization
All AI provider clients (`OpenAI` instances in `lib/ai/providers/`) are initialized lazily inside a `client()` getter function, not at module load time. This prevents `next build` from failing when API keys are absent in CI/CD environments.

### Graceful Fallback Pattern
Every component and API route checks `isSupabaseConfigured()` before using Supabase. When unconfigured, mock data is used instead. This makes local development work with zero env vars.

### Mycelium Animation Architecture
The canvas animation lives entirely in `useRef` state (never `useState`) inside `useMyceliumAnimation`. Animation is advanced inside `nodeCanvasObject`/`linkCanvasObject` callbacks which react-force-graph-2d calls every RAF frame — no separate `requestAnimationFrame` loop needed.

### Cosine Similarity in JS (not pgvector RPC)
The wiki query endpoint (`/api/wiki/query`) fetches all `concept_nodes` with embeddings and computes cosine similarity in JavaScript. This avoids needing a custom `match_concepts` Supabase RPC function and is acceptable for small datasets (20–200 concepts).

### CSS: Tailwind v3 + shadcn
This project uses **Tailwind CSS v3** (not v4). The `globals.css` must use `@tailwind base/components/utilities` directives — do NOT use `@import "tw-animate-css"` or `@import "shadcn/tailwind.css"` (those are v4-only). All shadcn token colors (`border`, `ring`, `card`, etc.) are defined in `tailwind.config.ts` as CSS variable references.

### Admin Panel Access
Corner-tap gesture: top-left → top-right → bottom-right → bottom-left within 5 seconds. Each corner div is 80×80px, z-index 20, transparent. After gesture succeeds, a PIN modal appears. PIN is set via `ADMIN_PIN` env var (default: `123456` in dev).

### BullMQ in API Route
`/api/papers` (POST) dynamically imports BullMQ + IORedis to enqueue jobs. The import is wrapped in try/catch so paper record creation succeeds even when `REDIS_URL` is absent. Worker simply won't process the job until Redis is configured.
