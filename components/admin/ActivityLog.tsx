'use client'

import { useState, useEffect } from 'react'

interface LogEntry {
  id: string
  timestamp: Date
  type: 'paper_added' | 'relation_approved' | 'relation_rejected' | 'wiki_updated' | 'concept_created'
  title: string
  detail: string
}

const MOCK_LOG: LogEntry[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    type: 'relation_approved',
    title: 'Relación aprobada',
    detail: 'Modelos de Lenguaje ↔ Redes Neuronales Profundas',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    type: 'paper_added',
    title: 'Artículo procesado',
    detail: 'Aplicaciones de IA en Diagnóstico Médico — Ciencias para la Salud',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 38 * 60 * 1000),
    type: 'wiki_updated',
    title: 'Wiki actualizada',
    detail: 'Nodo "machine_learning" integró 3 nuevos conceptos',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 72 * 60 * 1000),
    type: 'concept_created',
    title: 'Concepto creado',
    detail: 'Nuevo nodo: "transferencia_de_conocimiento"',
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    type: 'relation_rejected',
    title: 'Relación rechazada',
    detail: 'Cultivos Sostenibles ↔ Redes Neuronales (similitud insuficiente)',
  },
  {
    id: '6',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    type: 'paper_added',
    title: 'Artículo procesado',
    detail: 'Técnicas de Cultivo Hidropónico en Colombia — Ciencias Agropecuarias',
  },
  {
    id: '7',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    type: 'relation_approved',
    title: 'Relación aprobada',
    detail: 'Biodiversidad Tropical ↔ Modelos Predictivos de Ecosistemas',
  },
  {
    id: '8',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    type: 'wiki_updated',
    title: 'Wiki actualizada',
    detail: 'Nodo "biodiversidad" integró 5 nuevos conceptos',
  },
]

const TYPE_CONFIG: Record<LogEntry['type'], { icon: string; color: string; dot: string }> = {
  paper_added:        { icon: '📄', color: 'text-cyan-400',   dot: 'bg-cyan-400' },
  relation_approved:  { icon: '✅', color: 'text-green-400',  dot: 'bg-green-400' },
  relation_rejected:  { icon: '❌', color: 'text-red-400',    dot: 'bg-red-400' },
  wiki_updated:       { icon: '🧠', color: 'text-violet-400', dot: 'bg-violet-400' },
  concept_created:    { icon: '💡', color: 'text-yellow-400', dot: 'bg-yellow-400' },
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `hace ${diff}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)}d`
}

interface ActivityLogProps {
  lang: 'es' | 'en'
}

export default function ActivityLog({ lang }: ActivityLogProps) {
  const [entries, setEntries] = useState<LogEntry[]>(MOCK_LOG)
  const [, setTick] = useState(0)

  // Refresh relative timestamps every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const labels = {
    title:   lang === 'es' ? 'Registro de Actividad'       : 'Activity Log',
    empty:   lang === 'es' ? 'Sin actividad reciente'      : 'No recent activity',
    refresh: lang === 'es' ? 'Simular nueva entrada'       : 'Simulate new entry',
  }

  function addMockEntry() {
    const types: LogEntry['type'][] = ['paper_added', 'relation_approved', 'wiki_updated', 'concept_created']
    const type = types[Math.floor(Math.random() * types.length)]
    const newEntry: LogEntry = {
      id: String(Date.now()),
      timestamp: new Date(),
      type,
      title: TYPE_CONFIG[type].icon + ' ' + (
        type === 'paper_added' ? 'Artículo procesado' :
        type === 'relation_approved' ? 'Relación aprobada' :
        type === 'wiki_updated' ? 'Wiki actualizada' : 'Concepto creado'
      ),
      detail: 'Nueva entrada de actividad simulada — ' + new Date().toLocaleTimeString(),
    }
    setEntries(prev => [newEntry, ...prev])
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
        <button
          onClick={addMockEntry}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
        >
          {labels.refresh}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {entries.length === 0 ? (
          <p className="text-gray-500 text-sm text-center mt-8">{labels.empty}</p>
        ) : (
          entries.map((entry, idx) => {
            const cfg = TYPE_CONFIG[entry.type]
            return (
              <div
                key={entry.id}
                className="flex gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
                style={{ animation: idx === 0 ? 'fadeIn 0.3s ease-out' : undefined }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${cfg.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-medium ${cfg.color}`}>{entry.title}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{timeAgo(entry.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{entry.detail}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
