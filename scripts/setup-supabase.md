# Supabase Setup — Knowledge Graph UCaldas

Complete setup guide for the Supabase backend. Do these steps in order.

---

## 1. Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click **New project**
3. Name: `knowledge-graph-ucaldas`
4. Database password: generate a strong one and save it
5. Region: choose closest to Colombia (e.g. São Paulo `sa-east-1`)
6. Click **Create new project** and wait ~2 minutes

---

## 2. Enable pgvector Extension

In the Supabase dashboard:

1. Go to **Database → Extensions**
2. Search for `vector`
3. Toggle **vector** ON
4. Confirm the prompt

---

## 3. Run Migrations

In the Supabase dashboard go to **SQL Editor → New query**.
You must paste the **SQL content** of each file (not the filename itself).

**Migration 1:** Open `supabase/migrations/001_initial.sql` in your editor, select all (`Ctrl+A`), copy, paste into SQL Editor, click **Run**.

**Migration 2:** Paste the following and click **Run**:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE relations;
ALTER PUBLICATION supabase_realtime ADD TABLE processing_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE concept_nodes;
```

Alternatively, use the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

---

## 4. Configure Realtime (UI Method)

Enable replication for the tables that need live updates (if you didn't run the SQL in Step 3):

1. Go to **Database → Publications**
2. Click on the **supabase_realtime** publication
3. Click **Edit** (or search for the tables section)
4. Select/Toggle these tables:
   - `relations`
   - `processing_jobs`
   - `concept_nodes`
5. Click **Save** (or **Update publication**)

---

---

## 5. Create Storage Bucket

1. Go to **Storage → Buckets**
2. Click **New bucket**
3. Name: `papers`
4. Toggle **Public bucket** OFF (private)
5. Click **Create bucket**

Then set up the storage policy:

1. Click the `papers` bucket → **Policies**
2. Click **New policy** → **For full customization**
3. Policy name: `service-role-full-access`
4. Allowed operations: SELECT, INSERT, UPDATE, DELETE
5. Policy definition (copy ONLY the line inside, NOT the backticks):
   ```sql
   (auth.role() = 'service_role')
   ```
6. Click **Review** → **Save policy**

---

## 6. Get API Keys

Go to **Settings → API**:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL field |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (keep secret!) |

---

## 7. Environment Variables

### `.env.local` (Next.js frontend — Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

OPENROUTER_API_KEY=sk-or-...          # https://openrouter.ai/keys
GITHUB_TOKEN=ghp_...                  # GitHub → Settings → Developer settings → Tokens (classic), scope: none needed
ADMIN_PIN=123456                       # 6-digit PIN for admin panel

SIMILARITY_THRESHOLD=0.75
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Optional model overrides (defaults shown)
LLM_MODEL_HEAVY=deepseek/deepseek-r1:free
LLM_MODEL_STANDARD=meta-llama/llama-3.3-70b-instruct:free
LLM_MODEL_FAST=meta-llama/llama-3.2-3b-instruct:free
EMBEDDING_MODEL=text-embedding-3-small
MAX_TEXT_CHARS_FOR_EMBEDDING=8000
MAX_TEXT_CHARS_FOR_EXTRACTION=6000
```

### Railway Worker Service

Add these in Railway → your worker service → **Variables**:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

OPENROUTER_API_KEY=sk-or-...
GITHUB_TOKEN=ghp_...

REDIS_URL=redis://...                  # Railway → Add Redis → copy URL

SIMILARITY_THRESHOLD=0.75
MAX_RELATIONS_PER_PAPER=10
```

---

## 8. Vercel Secrets Setup

Instead of pasting raw values, use Vercel environment secrets:

```bash
vercel secrets add supabase-url "https://YOUR_PROJECT_REF.supabase.co"
vercel secrets add supabase-anon-key "eyJ..."
vercel secrets add supabase-service-role-key "eyJ..."
vercel secrets add openrouter-api-key "sk-or-..."
vercel secrets add github-token "ghp_..."
vercel secrets add admin-pin "123456"
vercel secrets add redis-url "redis://..."
```

The `vercel.json` already maps these secret names to the correct env var names.

---

## 9. Verify Setup

After deploying, test each piece:

1. **Graph loads**: visit `/` — should show the force-directed graph with mock data
2. **Admin panel**: tap the 4 corners (TL → TR → BR → BL) and enter PIN → drawer opens
3. **Upload**: upload a PDF → progress bar should animate (simulated if no Redis)
4. **Wiki query**: type a question in the WikiExplorer search
5. **Realtime**: open two browser tabs, approve a relation in admin → graph updates in the other tab

---

## Migration Files Reference

The migrations should create these tables:

```sql
-- papers: metadata + embeddings
-- relations: AI-proposed paper connections
-- concept_nodes: accumulated wiki knowledge
-- paper_concepts: many-to-many junction
-- processing_jobs: upload pipeline progress
-- wiki_log: audit trail
```

See `supabase/migrations/` for the complete SQL.
