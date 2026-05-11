-- 003_add_missing_columns.sql
-- Agrega department (texto) y title_en a papers
-- Simplifica el modelo: departments como texto libre en vez de FK

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS title_en   TEXT;
