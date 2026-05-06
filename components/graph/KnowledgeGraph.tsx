'use client'

import dynamic from 'next/dynamic'
import { useRef, useState, useCallback, useEffect } from 'react'
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d'
import type { KGNodeData, KGLinkData } from '@/lib/data/mock'
import { MOCK_NODES, MOCK_LINKS, DEPT_COLORS } from '@/lib/data/mock'
import { useMyceliumAnimation } from './MyceliumAnimation'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { subscribeToApprovedRelations, subscribeToConceptNodes } from '@/lib/supabase/realtime'
import type { RelationRow, ConceptNodeRow } from '@/lib/supabase/realtime'

// ── Dynamic import: avoids SSR (uses canvas/window APIs) ──────────────────────
type FGComponent = React.ComponentType<Record<string, unknown>>

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then(m => m.default as unknown as FGComponent),
  { ssr: false, loading: () => null }
) as FGComponent

// ── Props ─────────────────────────────────────────────────────────────────────

export interface KnowledgeGraphHandle {
  triggerMyceliumGrowth: (srcId: string, tgtId: string, relationType: string) => void
}

interface KnowledgeGraphProps {
  lang: 'es' | 'en'
  onNodeSelect?: (node: KGNodeData | null) => void
  handleRef?: React.MutableRefObject<KnowledgeGraphHandle | null>
  onStatsChange?: (stats: { papers: number; relations: number; concepts: number }) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relationToLink(row: RelationRow): KGLinkData {
  return {
    source:        row.paper_a_id,
    target:        row.paper_b_id,
    similarity:    row.similarity,
    relation_type: row.relation_type,
    link_type:     'relation',
    explanation_es: row.explanation_es ?? undefined,
  }
}

function conceptToNode(row: ConceptNodeRow): KGNodeData {
  return {
    id:           row.id,
    type:         'concept',
    label:        row.name_es,
    name_es:      row.name_es,
    name_en:      row.name_en ?? undefined,
    slug:         row.slug,
    paper_count:  row.paper_count,
    concept_type: row.type as KGNodeData['concept_type'],
    summary_es:   row.summary_es ?? undefined,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function KnowledgeGraph({
  lang: _lang, // eslint-disable-line @typescript-eslint/no-unused-vars
  onNodeSelect,
  handleRef,
  onStatsChange,
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<KGNodeData, KGLinkData>>(null)
  const hasZoomedRef = useRef(false)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Graph data — starts with mock, replaced by real data when Supabase is ready
  const [nodes, setNodes] = useState<KGNodeData[]>(MOCK_NODES)
  const [links, setLinks] = useState<KGLinkData[]>(MOCK_LINKS)
  const usingReal = useRef(false)

  // ── Mycelium animation engine ──────────────────────────────────────────────
  const { renderLink, renderNode, triggerGrowth, onUserInteraction } = useMyceliumAnimation({
    selectedId,
    fgRef,
    nodes,
  })

  // Expose triggerGrowth to parent (admin panel → approve relation)
  useEffect(() => {
    if (handleRef) handleRef.current = { triggerMyceliumGrowth: triggerGrowth }
  }, [handleRef, triggerGrowth])

  // ── Fetch real graph data from Supabase ────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    fetch('/api/papers')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data: { nodes: KGNodeData[]; links: KGLinkData[]; stats: { papers: number; relations: number; concepts: number } }) => {
        if (data.nodes?.length > 0 || data.links?.length > 0) {
          setNodes(data.nodes ?? [])
          setLinks(data.links ?? [])
          usingReal.current = true
          onStatsChange?.(data.stats)
        }
      })
      .catch(err => console.warn('[KnowledgeGraph] Could not load real data, using mock:', err))
  }, [onStatsChange])

  // ── Realtime: new approved relations → add to graph + animate ─────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const unsub = subscribeToApprovedRelations((row: RelationRow) => {
      const newLink = relationToLink(row)
      setLinks(prev => {
        // Skip if already in graph
        if (prev.some(l => l.source === row.paper_a_id && l.target === row.paper_b_id)) return prev
        return [...prev, newLink]
      })
      // Trigger mycelium growth animation
      triggerGrowth(row.paper_a_id, row.paper_b_id, row.relation_type)
    })

    return unsub
  }, [triggerGrowth])

  // ── Realtime: new/updated concept_nodes → add to graph ───────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const unsub = subscribeToConceptNodes((row: ConceptNodeRow, eventType) => {
      const node = conceptToNode(row)
      setNodes(prev => {
        if (eventType === 'INSERT') {
          if (prev.some(n => n.id === row.id)) return prev
          return [...prev, node]
        }
        // UPDATE: replace existing
        return prev.map(n => n.id === row.id ? { ...n, ...node } : n)
      })
    })

    return unsub
  }, [])

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── D3 forces ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = (fg as any).d3Force('charge')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link   = (fg as any).d3Force('link')
    if (charge) charge.strength(-160)
    if (link)   link.distance(90)
  })

  // ── Engine stop: zoom + trigger demo animations on first load ─────────────
  const handleEngineStop = useCallback(() => {
    if (hasZoomedRef.current) return
    hasZoomedRef.current = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(fgRef.current as any)?.zoomToFit(600, 60)

    // Demo: animate first 3 relation-type links
    const relLinks = links.filter(l => l.link_type === 'relation').slice(0, 3)
    relLinks.forEach((link, i) => {
      setTimeout(() => {
        const src = typeof link.source === 'object'
          ? (link.source as KGNodeData).id as string
          : link.source as string
        const tgt = typeof link.target === 'object'
          ? (link.target as KGNodeData).id as string
          : link.target as string
        triggerGrowth(src, tgt, link.relation_type)
      }, 800 + i * 2_200)
    })
  }, [triggerGrowth, links])

  // ── Interaction handlers ───────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (node: NodeObject<KGNodeData>) => {
      onUserInteraction()
      const id = node.id as string
      const next = selectedId === id ? null : id
      setSelectedId(next)
      onNodeSelect?.(next ? (node as unknown as KGNodeData) : null)
    },
    [selectedId, onNodeSelect, onUserInteraction]
  )

  const handleBgClick = useCallback(() => {
    onUserInteraction()
    setSelectedId(null)
    onNodeSelect?.(null)
  }, [onNodeSelect, onUserInteraction])

  const handleNodeDrag = useCallback(() => { onUserInteraction() }, [onUserInteraction])

  // ── nodePointerAreaPaint ───────────────────────────────────────────────────
  const renderPointerArea = useCallback(
    (node: NodeObject<KGNodeData>, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const size = node.type === 'concept'
        ? Math.max(10, Math.min(28, 8 + (node.paper_count ?? 1) * 3.5)) + 4
        : Math.max(8, Math.min(24, 6 + (node.connectionCount ?? 1) * 2.5)) + 4
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    },
    []
  )

  const graphData = {
    nodes: nodes as unknown as NodeObject<KGNodeData>[],
    links: links as unknown as LinkObject<KGNodeData, KGLinkData>[],
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#040810"
          nodeCanvasObject={renderNode}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={renderPointerArea}
          linkCanvasObject={renderLink}
          linkCanvasObjectMode={() => 'replace'}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBgClick}
          onNodeDrag={handleNodeDrag}
          warmupTicks={40}
          cooldownTicks={200}
          onEngineStop={handleEngineStop}
          enableZoomInteraction
          enablePanInteraction
          enableNodeDrag
          minZoom={0.3}
          maxZoom={8}
        />
      )}
    </div>
  )
}

// Re-export DEPT_COLORS so consumers don't need to import from mock
export { DEPT_COLORS }
