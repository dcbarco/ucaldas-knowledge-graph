-- ============================================================
-- seed.sql — Datos iniciales: Departamentos Universidad de Caldas
-- ============================================================
-- Ejecutar después de 001_initial.sql
-- Colores tomados de la paleta bioluminiscente del diseño (spec §10.2)
-- ============================================================

INSERT INTO departments (id, name_es, name_en, color, icon) VALUES
  (
    gen_random_uuid(),
    'Artes y Humanidades',
    'Arts and Humanities',
    '#EF4444',  -- coral
    '🎨'
  ),
  (
    gen_random_uuid(),
    'Ciencias Agropecuarias',
    'Agricultural and Veterinary Sciences',
    '#84CC16',  -- lima
    '🌿'
  ),
  (
    gen_random_uuid(),
    'Ciencias Exactas y Naturales',
    'Exact and Natural Sciences',
    '#06B6D4',  -- cyan
    '🔬'
  ),
  (
    gen_random_uuid(),
    'Ciencias Jurídicas y Sociales',
    'Legal and Social Sciences',
    '#8B5CF6',  -- violeta
    '⚖️'
  ),
  (
    gen_random_uuid(),
    'Ciencias para la Salud',
    'Health Sciences',
    '#10B981',  -- esmeralda
    '🧬'
  ),
  (
    gen_random_uuid(),
    'Inteligencia Artificial e Ingenierías',
    'Artificial Intelligence and Engineering',
    '#F59E0B',  -- ámbar
    '⚙️'
  );

-- Verificar inserción:
-- SELECT name_es, color FROM departments ORDER BY name_es;
