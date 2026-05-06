'use client'

import { useRef, useCallback } from 'react'
import type { NodeObject, LinkObject, ForceGraphMethods } from 'react-force-graph-2d'
import type { KGNodeData, KGLinkData } from '@/lib/data/mock'

// ── Types ────────────────────────────────────────────────────────────────────

interface Vec2 { x: number; y: number }

interface Branch {
  startT: number        // t on main curve where branch diverges
  endT: number          // t on main curve where branch rejoins
  cpPerpOffset: number  // signed perpendicular displacement at midpoint
}

interface Particle {
  leadOffset: number   // additional t ahead of growth front (0.025..0.10)
  opacity: number
  size: number
}

export interface AnimatingEdge {
  srcId: string
  tgtId: string
  relationType: string
  progress: number      // 0 → 1, advances GROWTH_SPEED per frame
  branches: Branch[]
  particles: Particle[]
  phase: 'growing' | 'done'
}

interface NodeAnimState {
  pulseStart: number    // performance.now() timestamp
  pulseDuration: number // ms
}

// ── Constants ────────────────────────────────────────────────────────────────

// 0.008/frame ≈ 125 frames ≈ 2s at 60fps (as per spec)
const GROWTH_SPEED   = 0.008
const IDLE_TIMEOUT   = 120_000  // ms
const BREATHE_SPEED  = 0.0008   // sin wave speed (rad/ms)
const IDLE_PAN_EVERY = 30_000   // ms between idle camera pans

const EDGE_COLORS: Record<string, string> = {
  semantic:       'rgba(139, 92, 246, 0.65)',
  methodological: 'rgba(6, 182, 212, 0.65)',
  thematic:       'rgba(16, 185, 129, 0.65)',
  paper_concept:  'rgba(100, 116, 139, 0.35)',
}

// ── Bezier math ──────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function lerpV(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

// Point on quadratic bezier at t
function evalQ(p0: Vec2, cp: Vec2, p2: Vec2, t: number): Vec2 {
  const q0 = lerpV(p0, cp, t)
  const q1 = lerpV(cp, p2, t)
  return lerpV(q0, q1, t)
}

// Tangent unit vector at t on quadratic bezier
function tangentQ(p0: Vec2, cp: Vec2, p2: Vec2, t: number): Vec2 {
  const dt = 0.01
  const ta = Math.max(t - dt, 0)
  const tb = Math.min(t + dt, 1)
  const pa = evalQ(p0, cp, p2, ta)
  const pb = evalQ(p0, cp, p2, tb)
  const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1
  return { x: (pb.x - pa.x) / len, y: (pb.y - pa.y) / len }
}

// Draw partial quadratic bezier from t=0 to t=end using De Casteljau
// Sub-bezier control = lerp(P0, CP, t); endpoint = evalQ(P0, CP, P2, t)
function drawPartialQ(
  ctx: CanvasRenderingContext2D,
  p0: Vec2, cp: Vec2, p2: Vec2,
  end: number
) {
  if (end <= 0) return
  const t = Math.min(end, 1)
  const subCp = lerpV(p0, cp, t)
  const ep = evalQ(p0, cp, p2, t)
  ctx.moveTo(p0.x, p0.y)
  ctx.quadraticCurveTo(subCp.x, subCp.y, ep.x, ep.y)
}

// ── Hexagon helper ───────────────────────────────────────────────────────────

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    if (i === 0) {
      ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
    } else {
      ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
    }
  }
  ctx.closePath()
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseMyceliumOptions {
  selectedId: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fgRef: React.RefObject<ForceGraphMethods<any, any>>
  nodes: KGNodeData[]
}

export function useMyceliumAnimation({ selectedId, fgRef, nodes }: UseMyceliumOptions) {
  // Animation state in refs — never setState (would cause re-renders inside canvas RAF)
  const animEdges    = useRef<Map<string, AnimatingEdge>>(new Map())
  const nodeAnims    = useRef<Map<string, NodeAnimState>>(new Map())
  // Keep nodes in a ref so checkIdlePan always sees the latest list
  const nodesRef     = useRef<KGNodeData[]>(nodes)
  nodesRef.current   = nodes
  const lastInteract = useRef<number>(Date.now())
  const nextPanAt    = useRef<number>(Date.now() + IDLE_PAN_EVERY)
  const selectedRef  = useRef<string | null>(selectedId)
  selectedRef.current = selectedId

  // ── triggerGrowth ──────────────────────────────────────────────────────────

  const triggerGrowth = useCallback(
    (srcId: string, tgtId: string, relationType: string) => {
      const key = `${srcId}::${tgtId}`
      if (animEdges.current.has(key)) return

      const branchCount = 2 + Math.floor(Math.random() * 3)
      const branches: Branch[] = Array.from({ length: branchCount }, () => {
        const startT = 0.15 + Math.random() * 0.45
        return {
          startT,
          endT: Math.min(startT + 0.12 + Math.random() * 0.18, 0.92),
          cpPerpOffset: (10 + Math.random() * 22) * (Math.random() > 0.5 ? 1 : -1),
        }
      }).sort((a, b) => a.startT - b.startT)

      const particles: Particle[] = Array.from(
        { length: 3 + Math.floor(Math.random() * 3) },
        () => ({
          leadOffset: 0.025 + Math.random() * 0.075,
          opacity: 0.45 + Math.random() * 0.45,
          size: 1.0 + Math.random() * 1.8,
        })
      )

      animEdges.current.set(key, {
        srcId, tgtId, relationType,
        progress: 0,
        branches,
        particles,
        phase: 'growing',
      })

      // Stagger pulses: source at ~70% growth, target at 100%
      const frameMs = 1000 / 60
      const totalFrames = 1.0 / GROWTH_SPEED
      const now = performance.now()
      nodeAnims.current.set(srcId, {
        pulseStart:    now + totalFrames * 0.70 * frameMs,
        pulseDuration: 600,
      })
      nodeAnims.current.set(tgtId, {
        pulseStart:    now + totalFrames * 1.00 * frameMs,
        pulseDuration: 600,
      })
    },
    []
  )

  const onUserInteraction = useCallback(() => {
    lastInteract.current = Date.now()
  }, [])

  // ── Shared idle helpers (called per-frame inside callbacks) ───────────────

  function getBreatheFactor(): number {
    const isIdle = Date.now() - lastInteract.current > IDLE_TIMEOUT
    if (!isIdle) return 1.0
    return 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(Date.now() * BREATHE_SPEED))
  }

  function checkIdlePan() {
    const now = Date.now()
    if (now - lastInteract.current < IDLE_TIMEOUT) return
    if (now < nextPanAt.current) return
    nextPanAt.current = now + IDLE_PAN_EVERY
    // KGNodeData doesn't declare x/y — they're injected by react-force-graph-2d at runtime
    type WithPos = KGNodeData & { x?: number; y?: number }
    const validNodes = (nodesRef.current as WithPos[]).filter(n => n.x != null && n.y != null)
    if (!validNodes.length || !fgRef.current) return
    const target = validNodes[Math.floor(Math.random() * validNodes.length)]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(fgRef.current as any).centerAt(target.x, target.y, 3000)
  }

  // ── renderLink ────────────────────────────────────────────────────────────

  const renderLink = useCallback(
    (link: LinkObject<KGNodeData, KGLinkData>, ctx: CanvasRenderingContext2D) => {
      const src = link.source as NodeObject<KGNodeData>
      const tgt = link.target as NodeObject<KGNodeData>
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return

      const breathe = getBreatheFactor()
      checkIdlePan()

      const p0: Vec2 = { x: src.x, y: src.y }
      const p2: Vec2 = { x: tgt.x, y: tgt.y }
      const dx = p2.x - p0.x, dy = p2.y - p0.y
      const cp: Vec2 = {
        x: (p0.x + p2.x) / 2 - dy * 0.15,
        y: (p0.y + p2.y) / 2 + dx * 0.15,
      }

      const srcId = src.id as string
      const tgtId = tgt.id as string
      const anim =
        animEdges.current.get(`${srcId}::${tgtId}`) ??
        animEdges.current.get(`${tgtId}::${srcId}`)

      // ── Mycelium growth animation ────────────────────────────────────────
      if (anim && anim.phase === 'growing') {
        anim.progress = Math.min(anim.progress + GROWTH_SPEED, 1)
        if (anim.progress >= 1) anim.phase = 'done'

        const t = anim.progress
        ctx.save()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // Main hifa — partial bezier with cyan bioluminiscente glow
        ctx.beginPath()
        drawPartialQ(ctx, p0, cp, p2, t)
        ctx.strokeStyle = `rgba(0, 255, 255, ${0.88 * breathe})`
        ctx.lineWidth = 1.8
        ctx.shadowBlur = 10
        ctx.shadowColor = '#00FFFF'
        ctx.stroke()

        // Outer halo pass (wider, fainter, for glow depth)
        ctx.beginPath()
        drawPartialQ(ctx, p0, cp, p2, t)
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.25 * breathe})`
        ctx.lineWidth = 4
        ctx.shadowBlur = 18
        ctx.shadowColor = '#00FFFF'
        ctx.stroke()

        // Secondary branches
        for (const b of anim.branches) {
          if (t <= b.startT) continue

          const branchProgress = (t - b.startT) / (b.endT - b.startT)
          const bStart = evalQ(p0, cp, p2, b.startT)
          const bEnd   = evalQ(p0, cp, p2, b.endT)

          // Perpendicular at branch start
          const tang = tangentQ(p0, cp, p2, b.startT)
          const nx = -tang.y, ny = tang.x   // left-hand normal

          // Branch bezier control = midpoint displaced perpendicular
          const midBX = (bStart.x + bEnd.x) / 2 + nx * b.cpPerpOffset
          const midBY = (bStart.y + bEnd.y) / 2 + ny * b.cpPerpOffset
          const bCp: Vec2 = { x: midBX, y: midBY }

          ctx.beginPath()
          if (branchProgress < 1) {
            drawPartialQ(ctx, bStart, bCp, bEnd, branchProgress)
          } else {
            ctx.moveTo(bStart.x, bStart.y)
            ctx.quadraticCurveTo(bCp.x, bCp.y, bEnd.x, bEnd.y)
          }
          ctx.strokeStyle = `rgba(0, 210, 255, ${0.42 * breathe})`
          ctx.lineWidth = 0.8
          ctx.shadowBlur = 5
          ctx.shadowColor = '#00EEFF'
          ctx.stroke()
        }

        // Particles ahead of the growth front
        for (const pt of anim.particles) {
          const ptT = t + pt.leadOffset
          if (ptT > 1) continue
          const pos = evalQ(p0, cp, p2, ptT)
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, pt.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(180, 255, 255, ${pt.opacity * breathe})`
          ctx.shadowBlur = 8
          ctx.shadowColor = '#00FFFF'
          ctx.fill()
        }

        ctx.restore()
        return
      }

      // ── Normal link rendering (with breathing) ──────────────────────────
      const isPaperConcept = link.link_type === 'paper_concept'
      const lineColor = isPaperConcept
        ? EDGE_COLORS.paper_concept
        : (EDGE_COLORS[link.relation_type ?? 'semantic'] ?? EDGE_COLORS.semantic)
      const lineWidth = isPaperConcept ? 0.6 : 0.5 + (link.similarity ?? 0.5) * 2.5

      ctx.save()
      ctx.globalAlpha = breathe
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y)
      if (isPaperConcept) ctx.setLineDash([3, 5])
      ctx.strokeStyle = lineColor
      ctx.lineWidth = lineWidth
      ctx.shadowBlur = isPaperConcept ? 2 : 5
      ctx.shadowColor = lineColor
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ── renderNode ────────────────────────────────────────────────────────────

  const renderNode = useCallback(
    (
      node: NodeObject<KGNodeData>,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const nodeId  = node.id as string
      const isSelected = nodeId === selectedRef.current
      const breathe = getBreatheFactor()

      // Pulse scale from connection event
      const animState = nodeAnims.current.get(nodeId)
      const now = performance.now()
      let scaleFactor = 1.0
      if (animState && now >= animState.pulseStart) {
        const frac = (now - animState.pulseStart) / animState.pulseDuration
        if (frac < 1) {
          scaleFactor = 1.0 + 0.4 * Math.sin(frac * Math.PI)  // 1.0 → 1.4 → 1.0
        } else {
          nodeAnims.current.delete(nodeId)
        }
      }

      ctx.save()
      ctx.globalAlpha = breathe

      if (scaleFactor !== 1.0) {
        ctx.translate(x, y)
        ctx.scale(scaleFactor, scaleFactor)
        ctx.translate(-x, -y)
      }

      if (node.type === 'concept') {
        _drawConceptNode(node, ctx, globalScale, isSelected)
      } else {
        _drawPaperNode(node, ctx, globalScale, isSelected)
      }

      ctx.restore()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return { renderLink, renderNode, triggerGrowth, onUserInteraction }
}

// ── Canvas draw primitives ────────────────────────────────────────────────────
// Kept here so MyceliumAnimation owns all canvas rendering logic.

function _drawPaperNode(
  node: NodeObject<KGNodeData>,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  isSelected: boolean
) {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const color = node.departmentColor ?? '#64748B'
  const size = Math.max(8, Math.min(24, 6 + (node.connectionCount ?? 1) * 2.5))

  // Permanent outer glow ring
  ctx.shadowBlur = isSelected ? 22 : 14
  ctx.shadowColor = color
  ctx.beginPath()
  ctx.arc(x, y, size * 1.55, 0, Math.PI * 2)
  ctx.fillStyle = isSelected ? `${color}44` : `${color}1A`
  ctx.fill()

  // Main circle
  ctx.shadowBlur = isSelected ? 18 : 10
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fillStyle = isSelected ? '#FFFFFF' : color
  ctx.fill()

  // Inner highlight
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(x - size * 0.28, y - size * 0.28, size * 0.32, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fill()

  if (globalScale > 1.4) {
    const fontSize = Math.max(3, 11 / globalScale)
    ctx.shadowBlur = 0
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillStyle = '#F0F4FF'
    ctx.textAlign = 'center'
    ctx.fillText(node.label ?? '', x, y + size + fontSize + 2)
  }
}

function _drawConceptNode(
  node: NodeObject<KGNodeData>,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  isSelected: boolean
) {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const size = Math.max(10, Math.min(28, 8 + (node.paper_count ?? 1) * 3.5))
  const color = isSelected ? '#FFFFFF' : '#A78BFA'

  // Permanent outer glow ring
  ctx.shadowBlur = isSelected ? 18 : 10
  ctx.shadowColor = '#8B5CF6'
  drawHexagon(ctx, x, y, size * 1.45)
  ctx.fillStyle = isSelected ? 'rgba(139,92,246,0.22)' : 'rgba(167,139,250,0.08)'
  ctx.fill()

  // Hexagon body
  drawHexagon(ctx, x, y, size)
  ctx.fillStyle = isSelected ? 'rgba(139,92,246,0.38)' : 'rgba(167,139,250,0.12)'
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = isSelected ? 2 : 1.5
  ctx.shadowBlur = isSelected ? 14 : 6
  ctx.stroke()

  if (globalScale > 1.2) {
    const fontSize = Math.max(3, 10 / globalScale)
    ctx.shadowBlur = 0
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillStyle = '#C4B5FD'
    ctx.textAlign = 'center'
    ctx.fillText(node.name_es ?? node.label ?? '', x, y + size + fontSize + 2)
  }
}
