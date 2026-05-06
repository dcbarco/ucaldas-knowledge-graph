'use client'

import { useEffect, useRef, useState } from 'react'

interface GraphStatsProps {
  papers: number
  relations: number
  concepts: number
  isProcessing?: boolean
  lang: 'es' | 'en'
}

// Anima un contador desde el valor anterior al nuevo
function useAnimatedCount(target: number, duration = 800) {
  const [count, setCount] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    const start = prev.current
    const diff = target - start
    if (diff === 0) return

    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = Math.min(now - startTime, duration)
      const progress = 1 - Math.pow(1 - elapsed / duration, 3) // ease-out cubic
      setCount(Math.round(start + diff * progress))
      if (elapsed < duration) requestAnimationFrame(tick)
      else prev.current = target
    }

    requestAnimationFrame(tick)
  }, [target, duration])

  return count
}

export default function GraphStats({
  papers,
  relations,
  concepts,
  isProcessing = false,
  lang,
}: GraphStatsProps) {
  const animPapers    = useAnimatedCount(papers)
  const animRelations = useAnimatedCount(relations)
  const animConcepts  = useAnimatedCount(concepts)

  const t = lang === 'es'
    ? { papers: 'papers', relations: 'relaciones', concepts: 'conceptos', learning: 'Sistema aprendiendo...' }
    : { papers: 'papers', relations: 'relations', concepts: 'concepts', learning: 'System learning...' }

  return (
    <div className="flex items-center justify-between w-full h-full px-6">
      {/* Stats */}
      <div className="flex items-center gap-6">
        <StatBadge icon="📄" value={animPapers}    label={t.papers}    color="#06B6D4" />
        <StatBadge icon="🔗" value={animRelations} label={t.relations} color="#8B5CF6" />
        <StatBadge icon="🧠" value={animConcepts}  label={t.concepts}  color="#10B981" />
      </div>

      {/* Indicador de procesamiento */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm" style={{ color: '#06B6D4' }}>
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: '#06B6D4' }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: '#06B6D4' }}
            />
          </span>
          <span className="font-mono text-xs" style={{ color: '#94A3B8' }}>
            {t.learning}
          </span>
        </div>
      )}
    </div>
  )
}

function StatBadge({
  icon,
  value,
  label,
  color,
}: {
  icon: string
  value: number
  label: string
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <span
        className="font-mono text-lg font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
      <span className="text-sm" style={{ color: '#94A3B8' }}>
        {label}
      </span>
    </div>
  )
}
