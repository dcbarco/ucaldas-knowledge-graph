'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client'
import { DEPT_COLORS } from '@/lib/data/mock'

interface PaperRow {
  id: string
  title: string
  department: string | null
  status: 'processing' | 'extracting' | 'embedding' | 'wiki_update' | 'relating' | 'ready' | 'error' | string
  created_at: string
}

interface ManagePapersProps {
  lang: 'es' | 'en'
}

const STATUS_BADGE: Record<string, { es: string; en: string; color: string }> = {
  ready:       { es: 'Listo',          en: 'Ready',       color: 'bg-green-500/20 text-green-400' },
  processing:  { es: 'Procesando',     en: 'Processing',  color: 'bg-cyan-500/20 text-cyan-400' },
  extracting:  { es: 'Extrayendo',     en: 'Extracting',  color: 'bg-cyan-500/20 text-cyan-400' },
  embedding:   { es: 'Embeddings',     en: 'Embeddings',  color: 'bg-cyan-500/20 text-cyan-400' },
  wiki_update: { es: 'Wiki',           en: 'Wiki',        color: 'bg-cyan-500/20 text-cyan-400' },
  relating:    { es: 'Relaciones',     en: 'Relations',   color: 'bg-cyan-500/20 text-cyan-400' },
  error:       { es: 'Error',          en: 'Error',       color: 'bg-red-500/20 text-red-400' },
}

export default function ManagePapers({ lang }: ManagePapersProps) {
  const [papers, setPapers] = useState<PaperRow[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)
  const [resetPhase, setResetPhase] = useState<'idle' | 'confirm1' | 'confirm2' | 'running' | 'done'>('idle')
  const [resetResult, setResetResult] = useState<{ papers: number; concepts: number; storage: number } | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  const labels = {
    title:        lang === 'es' ? 'Gestión de Papers'                : 'Paper Management',
    empty:        lang === 'es' ? 'No hay papers en la base de datos' : 'No papers in database',
    loading:      lang === 'es' ? 'Cargando papers...'               : 'Loading papers...',
    delete:       lang === 'es' ? 'Borrar'                           : 'Delete',
    confirm:      lang === 'es' ? '¿Confirmar?'                      : 'Confirm?',
    deleting:     lang === 'es' ? 'Borrando...'                      : 'Deleting...',
    reprocess:    lang === 'es' ? 'Reprocesar'                       : 'Reprocess',
    reprocessing: lang === 'es' ? 'Reprocesando...'                  : 'Reprocessing...',
    danger:       lang === 'es' ? 'Zona Peligrosa'                   : 'Danger Zone',
    resetBtn:     lang === 'es' ? 'Reset completo de la wiki'        : 'Full wiki reset',
    resetWarn:    lang === 'es' ? 'Borra TODOS los papers, conceptos y PDFs. No se puede deshacer.' : 'Wipes ALL papers, concepts and PDFs. Cannot be undone.',
    resetConfirm1: lang === 'es' ? '¿Estás seguro?'                   : 'Are you sure?',
    resetConfirm2: lang === 'es' ? 'Esto borrará TODO permanentemente. Última oportunidad.' : 'This will wipe EVERYTHING permanently. Last chance.',
    cancel:       lang === 'es' ? 'Cancelar'                         : 'Cancel',
    yesContinue:  lang === 'es' ? 'Sí, continuar'                    : 'Yes, continue',
    yesReset:     lang === 'es' ? 'Sí, BORRAR TODO'                  : 'Yes, WIPE ALL',
    resetting:    lang === 'es' ? 'Reseteando...'                    : 'Resetting...',
    resetDone:    lang === 'es' ? 'Wiki reseteada'                   : 'Wiki reset complete',
    close:        lang === 'es' ? 'Cerrar'                           : 'Close',
  }

  const fetchPapers = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('papers')
      .select('id, title, department, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ManagePapers] fetch error:', error.message)
      setPapers([])
    } else {
      setPapers((data ?? []) as PaperRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPapers() }, [fetchPapers])

  async function deletePaper(id: string) {
    setDeletingId(id)
    setConfirmId(null)
    try {
      const res = await fetch(`/api/papers/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[ManagePapers] delete failed:', res.status, body)
        return
      }
      setPapers(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  async function reprocessPaper(id: string) {
    setReprocessingId(id)
    try {
      const res = await fetch(`/api/papers/${id}/reprocess`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[ManagePapers] reprocess failed:', res.status, body)
        return
      }
      setPapers(prev => prev.map(p =>
        p.id === id ? { ...p, status: 'processing' } : p
      ))
    } finally {
      setReprocessingId(null)
    }
  }

  async function executeReset() {
    setResetPhase('running')
    setResetError(null)
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        setResetError(body.error ?? 'Reset failed')
        setResetPhase('confirm2')
        return
      }
      setResetResult({ papers: body.papers, concepts: body.concepts, storage: body.storage })
      setPapers([])
      setResetPhase('done')
    } catch (err) {
      setResetError(err instanceof Error ? err.message : String(err))
      setResetPhase('confirm2')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300 font-medium">
          {papers.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="text-center mt-8">
            <div className="w-6 h-6 mx-auto rounded-full border-2 border-t-transparent border-cyan-400 animate-spin mb-2" />
            <p className="text-gray-500 text-sm">{labels.loading}</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center mt-8">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-500 text-sm">{labels.empty}</p>
          </div>
        ) : (
          papers.map(p => {
            const dept = p.department ?? ''
            const color = DEPT_COLORS[dept] ?? '#64748B'
            const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.processing
            const isConfirming  = confirmId === p.id
            const isDeleting    = deletingId === p.id
            const isReprocessing = reprocessingId === p.id

            return (
              <div
                key={p.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-start gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 truncate">{p.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>
                      {lang === 'es' ? badge.es : badge.en}
                    </span>
                    {dept && <span className="text-[10px] text-gray-500 truncate">{dept}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => reprocessPaper(p.id)}
                    disabled={isReprocessing || isDeleting}
                    className="text-[11px] px-2 py-1 rounded-md transition-colors disabled:opacity-50 bg-white/5 text-gray-400 hover:bg-cyan-500/20 hover:text-cyan-400"
                    title={labels.reprocess}
                  >
                    {isReprocessing ? labels.reprocessing : `↻ ${labels.reprocess}`}
                  </button>
                  <button
                    onClick={() => isConfirming ? deletePaper(p.id) : setConfirmId(p.id)}
                    disabled={isDeleting || isReprocessing}
                    className={`text-[11px] px-2 py-1 rounded-md transition-colors disabled:opacity-50 ${
                      isConfirming
                        ? 'bg-red-500/30 text-red-300 hover:bg-red-500/50'
                        : 'bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400'
                    }`}
                  >
                    {isDeleting ? labels.deleting : isConfirming ? labels.confirm : `🗑 ${labels.delete}`}
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* Danger zone */}
        <div className="mt-6 pt-4 border-t border-red-500/20">
          <p className="text-[11px] text-red-400/70 uppercase tracking-wider mb-2">{labels.danger}</p>
          <button
            onClick={() => setResetPhase('confirm1')}
            className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-sm font-medium transition-colors"
          >
            ⚠️  {labels.resetBtn}
          </button>
          <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">{labels.resetWarn}</p>
        </div>
      </div>

      {/* Reset confirmation modal */}
      <AnimatePresence>
        {resetPhase !== 'idle' && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => resetPhase !== 'running' && setResetPhase('idle')}
            />
            <motion.div
              className="relative z-10 w-80 rounded-3xl bg-[#0a1020] border border-red-500/30 p-6 shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              {resetPhase === 'confirm1' && (
                <>
                  <div className="text-4xl text-center mb-3">⚠️</div>
                  <h3 className="text-center text-white font-semibold mb-2">{labels.resetConfirm1}</h3>
                  <p className="text-center text-xs text-gray-400 mb-5">{labels.resetWarn}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResetPhase('idle')}
                      className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                    >
                      {labels.cancel}
                    </button>
                    <button
                      onClick={() => setResetPhase('confirm2')}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/30 hover:bg-red-500/50 text-red-200 text-sm font-medium transition-colors"
                    >
                      {labels.yesContinue}
                    </button>
                  </div>
                </>
              )}

              {resetPhase === 'confirm2' && (
                <>
                  <div className="text-4xl text-center mb-3">🔥</div>
                  <h3 className="text-center text-red-400 font-semibold mb-2">{labels.resetConfirm2}</h3>
                  {resetError && (
                    <p className="text-center text-xs text-red-400 mb-3 bg-red-500/10 p-2 rounded">{resetError}</p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setResetPhase('idle')}
                      className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                    >
                      {labels.cancel}
                    </button>
                    <button
                      onClick={executeReset}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
                    >
                      {labels.yesReset}
                    </button>
                  </div>
                </>
              )}

              {resetPhase === 'running' && (
                <div className="text-center py-4">
                  <div className="w-10 h-10 mx-auto rounded-full border-3 border-t-transparent border-red-400 animate-spin mb-4" />
                  <p className="text-white font-medium">{labels.resetting}</p>
                </div>
              )}

              {resetPhase === 'done' && resetResult && (
                <>
                  <div className="text-5xl text-center mb-3">✅</div>
                  <h3 className="text-center text-green-400 font-semibold mb-3">{labels.resetDone}</h3>
                  <div className="text-xs text-gray-400 space-y-1 mb-5 px-2">
                    <p>📄 {resetResult.papers} papers</p>
                    <p>🧠 {resetResult.concepts} {lang === 'es' ? 'conceptos' : 'concepts'}</p>
                    <p>💾 {resetResult.storage} PDFs</p>
                  </div>
                  <button
                    onClick={() => { setResetPhase('idle'); setResetResult(null) }}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                  >
                    {labels.close}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
