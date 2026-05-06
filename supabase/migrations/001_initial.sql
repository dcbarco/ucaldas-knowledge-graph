-- ============================================================
-- 001_initial.sql — Knowledge Graph UCaldas
-- Schema completo con pgvector, RLS y triggers
-- ============================================================

-- ─── Extensiones ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Función reutilizable para updated_at ────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Función reutilizable para last_updated_at ───────────────
CREATE OR REPLACE FUNCTION trigger_set_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLA 1: departments
-- ============================================================
CREATE TABLE departments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name_es    TEXT        NOT NULL,
  name_en    TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#64748B',  -- HEX para el cluster del grafo
  icon       TEXT,                                    -- Emoji o slug de ícono
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLA 2: papers
-- ============================================================
CREATE TABLE papers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  authors       TEXT[]      NOT NULL DEFAULT '{}',
  department_id UUID        REFERENCES departments(id) ON DELETE SET NULL,
  year          INTEGER     CHECK (year > 1900 AND year <= extract(year FROM now()) + 1),
  abstract_es   TEXT,
  abstract_en   TEXT,
  language      TEXT        NOT NULL DEFAULT 'es'
                            CHECK (language IN ('es', 'en', 'both')),
  pdf_url       TEXT,       -- URL firmada Supabase Storage (expira)
  pdf_path      TEXT,       -- Path interno en bucket (permanente)
  full_text     TEXT,       -- Texto extraído del PDF por pdf-parse
  embedding     vector(1536),                         -- text-embedding-3-small
  concepts      JSONB       NOT NULL DEFAULT '{"methods": [], "themes": [], "keywords": []}',
  status        TEXT        NOT NULL DEFAULT 'processing'
                            CHECK (status IN ('processing', 'ready', 'error')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER papers_set_updated_at
  BEFORE UPDATE ON papers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLA 3: processing_jobs
-- ============================================================
CREATE TABLE processing_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id      UUID        NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'queued'
                            CHECK (status IN (
                              'queued', 'extracting', 'embedding',
                              'wiki_update', 'relating', 'done', 'error'
                            )),
  progress      INTEGER     NOT NULL DEFAULT 0
                            CHECK (progress >= 0 AND progress <= 100),
  current_step  TEXT,       -- Descripción legible del paso actual
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER processing_jobs_set_updated_at
  BEFORE UPDATE ON processing_jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLA 4: concept_nodes  (Capa Wiki — acumulativa)
-- ============================================================
CREATE TABLE concept_nodes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        UNIQUE NOT NULL,         -- 'analisis-redes-sociales'
  name_es         TEXT        NOT NULL,
  name_en         TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'theme'
                              CHECK (type IN ('method', 'theme', 'theory', 'field')),
  summary_es      TEXT,       -- Síntesis acumulada en español (IA la actualiza)
  summary_en      TEXT,       -- Accumulated synthesis in English
  paper_count     INTEGER     NOT NULL DEFAULT 0,
  embedding       vector(1536),                        -- Para búsqueda semántica de conceptos
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER concept_nodes_set_last_updated_at
  BEFORE UPDATE ON concept_nodes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_last_updated_at();

-- ============================================================
-- TABLA 5: paper_concepts  (Junction: papers ↔ concept_nodes)
-- ============================================================
CREATE TABLE paper_concepts (
  paper_id    UUID  NOT NULL REFERENCES papers(id)        ON DELETE CASCADE,
  concept_id  UUID  NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
  relevance   FLOAT NOT NULL DEFAULT 0.5
              CHECK (relevance >= 0 AND relevance <= 1),  -- Centralidad del concepto en el paper
  context_es  TEXT,   -- Cómo usa este paper el concepto (en español)
  context_en  TEXT,   -- How this paper uses the concept
  PRIMARY KEY (paper_id, concept_id)
);

-- ============================================================
-- TABLA 6: relations
-- ============================================================
CREATE TABLE relations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_a_id      UUID        NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  paper_b_id      UUID        NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  similarity      FLOAT       NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
  relation_type   TEXT        NOT NULL DEFAULT 'semantic'
                              CHECK (relation_type IN ('semantic', 'methodological', 'thematic')),
  shared_concepts JSONB       NOT NULL DEFAULT '[]',  -- Array de concept slugs compartidos
  explanation_es  TEXT,
  explanation_en  TEXT,
  status          TEXT        NOT NULL DEFAULT 'proposed'
                              CHECK (status IN ('proposed', 'approved', 'rejected')),
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  approved_by     TEXT,       -- 'admin' cuando se aprueba desde el panel
  CONSTRAINT no_self_relation CHECK (paper_a_id != paper_b_id)
);

-- ============================================================
-- TABLA 7: wiki_log  (append-only — nunca UPDATE ni DELETE)
-- ============================================================
CREATE TABLE wiki_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL
              CHECK (event_type IN ('ingest', 'relation_approved', 'concept_updated', 'lint')),
  title       TEXT        NOT NULL,   -- Resumen legible del evento
  details     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- pgvector HNSW: búsqueda por similitud coseno
-- HNSW > IVFFlat para datasets pequeños (no requiere entrenamiento)
-- m=16 (conexiones por nodo), ef_construction=64 (calidad de construcción)
CREATE INDEX idx_papers_embedding
  ON papers USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_concept_nodes_embedding
  ON concept_nodes USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Papers: filtros de estado y listados
CREATE INDEX idx_papers_status          ON papers (status);
CREATE INDEX idx_papers_department_id   ON papers (department_id);
CREATE INDEX idx_papers_created_at      ON papers (created_at DESC);

-- Relations: joins y filtros de estado (alta frecuencia de lectura)
CREATE INDEX idx_relations_paper_a      ON relations (paper_a_id);
CREATE INDEX idx_relations_paper_b      ON relations (paper_b_id);
CREATE INDEX idx_relations_status       ON relations (status);
CREATE INDEX idx_relations_proposed_at  ON relations (proposed_at DESC);

-- Relations: lookup inverso (dado un paper, encontrar todas sus relaciones)
CREATE INDEX idx_relations_any_paper    ON relations (paper_a_id, paper_b_id);

-- Processing jobs: progreso en tiempo real
CREATE INDEX idx_processing_jobs_paper  ON processing_jobs (paper_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs (status);

-- Concept nodes: listados por tipo y popularidad
CREATE INDEX idx_concept_nodes_type        ON concept_nodes (type);
CREATE INDEX idx_concept_nodes_paper_count ON concept_nodes (paper_count DESC);

-- Paper concepts: lookup inverso (dado un concepto, encontrar sus papers)
CREATE INDEX idx_paper_concepts_concept_id ON paper_concepts (concept_id);

-- Wiki log: historial cronológico y filtro por tipo
CREATE INDEX idx_wiki_log_created_at   ON wiki_log (created_at DESC);
CREATE INDEX idx_wiki_log_event_type   ON wiki_log (event_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_nodes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_concepts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE relations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_log          ENABLE ROW LEVEL SECURITY;

-- ── Lectura pública (kiosko — rol anon) ──────────────────────
-- El kiosk frontend usa la anon key; el service_role (worker/API) bypassea RLS.

CREATE POLICY "anon_read_departments" ON departments
  FOR SELECT TO anon USING (true);

-- El kiosko lee todos los papers (filtra por status en la app)
CREATE POLICY "anon_read_papers" ON papers
  FOR SELECT TO anon USING (true);

-- El kiosko muestra progreso de procesamiento en tiempo real
CREATE POLICY "anon_read_processing_jobs" ON processing_jobs
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_concept_nodes" ON concept_nodes
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_paper_concepts" ON paper_concepts
  FOR SELECT TO anon USING (true);

-- El kiosko solo visualiza relaciones aprobadas
-- Las relaciones 'proposed'/'rejected' solo las lee el admin (via service_role)
CREATE POLICY "anon_read_approved_relations" ON relations
  FOR SELECT TO anon USING (status = 'approved');

CREATE POLICY "anon_read_wiki_log" ON wiki_log
  FOR SELECT TO anon USING (true);

-- ── Escritura: solo via service_role (API Routes + Worker) ───
-- service_role bypassea RLS por defecto en Supabase.
-- Las políticas de escritura son una capa defensiva adicional.

CREATE POLICY "service_all_departments" ON departments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_papers" ON papers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_processing_jobs" ON processing_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_concept_nodes" ON concept_nodes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_paper_concepts" ON paper_concepts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_relations" ON relations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- wiki_log: solo INSERT (append-only). Nunca UPDATE ni DELETE.
CREATE POLICY "service_insert_wiki_log" ON wiki_log
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_read_wiki_log" ON wiki_log
  FOR SELECT TO service_role USING (true);
