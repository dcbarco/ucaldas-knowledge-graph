'use client'

import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import GraphStats from '@/components/graph/GraphStats'
import AdminDrawer from '@/components/admin/AdminDrawer'
import { MOCK_STATS } from '@/lib/data/mock'
import type { KGNodeData } from '@/lib/data/mock'
import type { KnowledgeGraphHandle } from '@/components/graph/KnowledgeGraph'

// KnowledgeGraph también es cliente pero lo importamos normalmente
// ya que page.tsx es 'use client'. ForceGraph2D se lazy-load dentro.
const KnowledgeGraph = dynamic(
  () => import('@/components/graph/KnowledgeGraph'),
  { ssr: false, loading: () => <GraphLoading /> }
)

function GraphLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <div
          className="w-16 h-16 mx-auto rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#06B6D4', borderTopColor: 'transparent' }}
        />
        <p className="text-sm font-mono" style={{ color: '#94A3B8' }}>
          Cargando grafo...
        </p>
      </div>
    </div>
  )
}

// Panel flotante de detalle de nodo seleccionado
function NodeDetailPanel({
  node,
  lang,
  onClose,
}: {
  node: KGNodeData
  lang: 'es' | 'en'
  onClose: () => void
}) {
  const isPaper = node.type === 'paper'
  const color = isPaper ? (node.departmentColor ?? '#64748B') : '#8B5CF6'

  return (
    <div
      className="absolute bottom-24 left-4 right-4 rounded-2xl p-5 z-10 backdrop-blur-xl"
      style={{
        background: 'rgba(8,15,26,0.88)',
        border: `1px solid ${color}44`,
        boxShadow: `0 0 24px ${color}22`,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isPaper ? (
            <>
              <p className="text-xs font-mono mb-1" style={{ color }}>
                {node.department} · {node.year}
              </p>
              <h2 className="text-base font-semibold leading-snug mb-2" style={{ color: '#F0F4FF' }}>
                {lang === 'es' ? node.title : (node.title_en ?? node.title)}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
                {lang === 'es' ? node.abstract_es : (node.abstract_en ?? node.abstract_es)}
              </p>
              {node.authors && (
                <p className="text-xs mt-2 font-mono" style={{ color: '#64748B' }}>
                  {node.authors.join(' · ')}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-mono mb-1" style={{ color: '#A78BFA' }}>
                {lang === 'es' ? 'Concepto Wiki' : 'Wiki Concept'} · {node.concept_type}
              </p>
              <h2 className="text-base font-semibold leading-snug mb-2" style={{ color: '#F0F4FF' }}>
                {lang === 'es' ? node.name_es : (node.name_en ?? node.name_es)}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
                {node.summary_es}
              </p>
              <p className="text-xs mt-2 font-mono" style={{ color: '#64748B' }}>
                {node.paper_count} {lang === 'es' ? 'papers lo mencionan' : 'papers reference this'}
              </p>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-lg"
          style={{ color: '#64748B', background: 'rgba(255,255,255,0.05)' }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ─── Kiosko principal ─────────────────────────────────────────
export default function KioskPage() {
  const [lang, setLang] = useState<'es' | 'en'>('es')
  const [selectedNode, setSelectedNode] = useState<KGNodeData | null>(null)
  const graphHandle = useRef<KnowledgeGraphHandle | null>(null)

  const handleNodeSelect = useCallback((node: KGNodeData | null) => {
    setSelectedNode(node)
  }, [])

  const toggleLang = useCallback(() => {
    setLang(l => l === 'es' ? 'en' : 'es')
  }, [])

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: '100vw',
        height: '100vh',
        background: '#040810',
        color: '#F0F4FF',
        fontFamily: 'var(--font-geist-sans), sans-serif',
      }}
    >
      {/* ── Header 80px ─────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-6 z-20"
        style={{
          height: 80,
          background: 'rgba(8,15,26,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(6,182,212,0.12)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #8B5CF6)', boxShadow: '0 0 12px rgba(6,182,212,0.4)' }}
          >
            UC
          </div>
          <div>
            <p className="text-xs font-mono leading-none" style={{ color: '#06B6D4' }}>
              Universidad de Caldas
            </p>
            <p className="text-sm font-semibold leading-snug" style={{ color: '#F0F4FF' }}>
              {lang === 'es' ? 'Red de Conocimiento' : 'Knowledge Network'}
            </p>
          </div>
        </div>

        {/* Toggle ES/EN */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all"
          style={{
            border: '1px solid rgba(6,182,212,0.4)',
            color: '#06B6D4',
            background: 'rgba(6,182,212,0.08)',
          }}
        >
          <span style={{ opacity: lang === 'es' ? 1 : 0.4 }}>ES</span>
          <span style={{ color: '#94A3B8' }}>/</span>
          <span style={{ opacity: lang === 'en' ? 1 : 0.4 }}>EN</span>
        </button>
      </header>

      {/* ── Canvas del grafo (80% del alto) ─────────────────── */}
      <main className="relative flex-1 min-h-0">
        <KnowledgeGraph lang={lang} onNodeSelect={handleNodeSelect} handleRef={graphHandle} />

        {/* Panel de detalle de nodo seleccionado */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            lang={lang}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </main>

      {/* ── Footer 80px ──────────────────────────────────────── */}
      <footer
        className="flex-shrink-0 z-20"
        style={{
          height: 80,
          background: 'rgba(8,15,26,0.85)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(139,92,246,0.12)',
        }}
      >
        <GraphStats
          papers={MOCK_STATS.papers}
          relations={MOCK_STATS.relations}
          concepts={MOCK_STATS.concepts}
          isProcessing={false}
          lang={lang}
        />
      </footer>

      {/* ── Admin Drawer (hidden; unlock via corner tap sequence) ── */}
      <AdminDrawer lang={lang} graphHandle={graphHandle} />
    </div>
  )
}
