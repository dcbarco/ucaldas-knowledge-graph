-- ============================================================
-- 002_realtime.sql — Habilitar Supabase Realtime
-- ============================================================
-- IMPORTANTE: Después de ejecutar esta migración, también debes
-- habilitar Replication en el Dashboard de Supabase:
--   Database → Replication → Source → Agregar las tablas listadas aquí.
-- Este SQL configura la publicación de PostgreSQL; el Dashboard
-- activa el canal WebSocket de Supabase Realtime sobre ella.
-- ============================================================

-- Habilitar replicación lógica en las tablas que necesitan Realtime:
--
--   relations         → El kiosko anima nuevas relaciones aprobadas (micelio)
--   processing_jobs   → El kiosko muestra progreso de ingestión en vivo
--   concept_nodes     → El admin panel refleja actualizaciones de la wiki

ALTER PUBLICATION supabase_realtime ADD TABLE relations;
ALTER PUBLICATION supabase_realtime ADD TABLE processing_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE concept_nodes;

-- Verificar que la publicación existe (read-only, para diagnóstico):
-- SELECT pubname, puballtables FROM pg_publication WHERE pubname = 'supabase_realtime';
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
