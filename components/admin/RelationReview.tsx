'use client'

import { useState, useEffect } from 'react'
import type { KnowledgeGraphHandle } from '@/components/graph/KnowledgeGraph'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { DEPT_COLORS } from '@/lib/data/mock'

interface ProposedRelation {
  id: string
  nodeIds: [string, string]          // matching MOCK_NODES ids
  relationType: string
  paper_a: { title: string; department: string; color: string }
  paper_b: { title: string; department: string; color: string }
  similarity: number
  explanation_es: string
  explanation_en: string
  status: 'pending' | 'approved' | 'rejected'
}

const MOCK_RELATIONS: ProposedRelation[] = [
  {
    id: 'r1',
    nodeIds: ['p1', 'p3'],
    relationType: 'methodological',
    paper_a: {
      title: 'Redes Neuronales para Diagnóstico de Enfermedades Tropicales',
      department: 'Ciencias para la Salud',
      color: '#10B981',
    },
    paper_b: {
      title: 'Modelos de Lenguaje Aplicados en Medicina Predictiva',
      department: 'Inteligencia Artificial e Ingenierías',
      color: '#F59E0B',
    },
    similarity: 0.87,
    explanation_es: 'Ambos artículos convergen en el uso de modelos computacionales para la predicción y diagnóstico médico. El primero aplica redes neuronales a enfermedades tropicales, mientras el segundo explora LLMs para medicina predictiva, compartiendo metodologías de entrenamiento y validación clínica.',
    explanation_en: 'Both papers converge on using computational models for medical prediction and diagnosis. The first applies neural networks to tropical diseases, while the second explores LLMs for predictive medicine, sharing training methodologies and clinical validation approaches.',
    status: 'pending',
  },
  {
    id: 'r2',
    nodeIds: ['p4', 'p2'],
    relationType: 'thematic',
    paper_a: {
      title: 'Biodiversidad de Macroinvertebrados en Ríos Andinos',
      department: 'Ciencias Exactas y Naturales',
      color: '#06B6D4',
    },
    paper_b: {
      title: 'Modelado Predictivo de Ecosistemas con Machine Learning',
      department: 'Inteligencia Artificial e Ingenierías',
      color: '#F59E0B',
    },
    similarity: 0.81,
    explanation_es: 'Los datos de biodiversidad del primer artículo sirven como conjunto de entrenamiento para los modelos del segundo. Hay una relación metodológica directa entre el muestreo ecológico y los algoritmos de clasificación aplicados.',
    explanation_en: 'Biodiversity data from the first paper serves as a training dataset for models in the second. There is a direct methodological relationship between ecological sampling and the applied classification algorithms.',
    status: 'pending',
  },
  {
    id: 'r3',
    nodeIds: ['p6', 'p8'],
    relationType: 'semantic',
    paper_a: {
      title: 'Técnicas de Cultivo Hidropónico en Zonas Cafeteras',
      department: 'Ciencias Agropecuarias',
      color: '#84CC16',
    },
    paper_b: {
      title: 'Análisis Filosófico del Arte Colombiano Contemporáneo',
      department: 'Artes y Humanidades',
      color: '#EF4444',
    },
    similarity: 0.34,
    explanation_es: 'Conexión débil basada únicamente en referencias geográficas compartidas (Colombia). No existe puente metodológico ni conceptual significativo entre la agronomía hidropónica y la filosofía del arte.',
    explanation_en: 'Weak connection based solely on shared geographical references (Colombia). No significant methodological or conceptual bridge exists between hydroponic agronomy and art philosophy.',
    status: 'pending',
  },
  {
    id: 'r4',
    nodeIds: ['p7', 'p5'],
    relationType: 'semantic',
    paper_a: {
      title: 'Acceso a la Justicia en Comunidades Rurales de Caldas',
      department: 'Ciencias Jurídicas y Sociales',
      color: '#8B5CF6',
    },
    paper_b: {
      title: 'Salud Mental en Poblaciones Vulnerables Post-Conflicto',
      department: 'Ciencias para la Salud',
      color: '#10B981',
    },
    similarity: 0.79,
    explanation_es: 'Ambos artículos abordan comunidades vulnerables en contextos de post-conflicto colombiano. El acceso a justicia y la salud mental son dimensiones interdependientes del bienestar comunitario que se retroalimentan metodológica y teóricamente.',
    explanation_en: 'Both papers address vulnerable communities in post-conflict Colombian contexts. Access to justice and mental health are interdependent dimensions of community well-being that inform each other methodologically and theoretically.',
    status: 'pending',
  },
]

interface RelationReviewProps {
  lang: 'es' | 'en'
  graphHandle: React.MutableRefObject<KnowledgeGraphHandle | null>
}

export default function RelationReview({ lang, graphHandle }: RelationReviewProps) {
  const [relations, setRelations] = useState<ProposedRelation[]>(MOCK_RELATIONS)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch real proposed relations from Supabase when configured
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    setLoading(true)

    // Use browser Supabase client with join on papers table
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase
        .from('relations')
        .select(`
          id, paper_a_id, paper_b_id, similarity, relation_type,
          explanation_es, explanation_en,
          paper_a:papers!paper_a_id(title, department),
          paper_b:papers!paper_b_id(title, department)
        `)
        .eq('status', 'proposed')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          setLoading(false)
          if (error || !data?.length) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: ProposedRelation[] = (data as any[]).map(r => ({
            id: r.id,
            nodeIds: [r.paper_a_id, r.paper_b_id] as [string, string],
            relationType: r.relation_type,
            paper_a: {
              title:      r.paper_a?.title      ?? r.paper_a_id,
              department: r.paper_a?.department ?? '',
              color:      DEPT_COLORS[r.paper_a?.department ?? ''] ?? '#64748B',
            },
            paper_b: {
              title:      r.paper_b?.title      ?? r.paper_b_id,
              department: r.paper_b?.department ?? '',
              color:      DEPT_COLORS[r.paper_b?.department ?? ''] ?? '#64748B',
            },
            similarity:     r.similarity,
            explanation_es: r.explanation_es ?? '',
            explanation_en: r.explanation_en ?? '',
            status: 'pending',
          }))
          setRelations(mapped)
        })
    })
  }, [])

  const pending  = relations.filter(r => r.status === 'pending')
  const resolved = relations.filter(r => r.status !== 'pending')

  const labels = {
    title:      lang === 'es' ? 'Revisión de Relaciones'   : 'Relation Review',
    pending:    lang === 'es' ? 'Pendientes'                : 'Pending',
    resolved:   lang === 'es' ? 'Resueltas'                : 'Resolved',
    approve:    lang === 'es' ? 'Aprobar'                  : 'Approve',
    reject:     lang === 'es' ? 'Rechazar'                 : 'Reject',
    similarity: lang === 'es' ? 'Similitud'                : 'Similarity',
    approved:   lang === 'es' ? 'Aprobada'                 : 'Approved',
    rejected:   lang === 'es' ? 'Rechazada'                : 'Rejected',
    noPending:  lang === 'es' ? 'Sin relaciones pendientes': 'No pending relations',
    loading:    lang === 'es' ? 'Cargando relaciones...'   : 'Loading relations...',
  }

  async function resolve(id: string, status: 'approved' | 'rejected') {
    // Call real API when Supabase is configured
    if (isSupabaseConfigured()) {
      try {
        await fetch(`/api/relations/${id}/${status}`, { method: 'POST' })
      } catch (err) {
        console.error('[RelationReview] resolve error:', err)
      }
    }
    if (status === 'approved') {
      const rel = relations.find(r => r.id === id)
      if (rel) {
        graphHandle.current?.triggerMyceliumGrowth(rel.nodeIds[0], rel.nodeIds[1], rel.relationType)
      }
    }
    setRelations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    if (expanded === id) setExpanded(null)
  }

  function RelationCard({ rel }: { rel: ProposedRelation }) {
    const isExpanded = expanded === rel.id
    const explanation = lang === 'es' ? rel.explanation_es : rel.explanation_en
    const simColor = rel.similarity >= 0.75 ? 'text-green-400' : rel.similarity >= 0.5 ? 'text-yellow-400' : 'text-red-400'
    const simBg = rel.similarity >= 0.75 ? 'bg-green-400/10' : rel.similarity >= 0.5 ? 'bg-yellow-400/10' : 'bg-red-400/10'

    return (
      <div className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
        <button
          className="w-full text-left p-3 hover:bg-white/5 transition-colors"
          onClick={() => setExpanded(isExpanded ? null : rel.id)}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: rel.paper_a.color }}
                />
                <span className="text-xs text-gray-300 truncate">{rel.paper_a.title}</span>
              </div>
              <div className="flex items-center gap-1.5 pl-0">
                <span className="text-gray-600 text-xs pl-0.5 flex-shrink-0">↕</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: rel.paper_b.color }}
                />
                <span className="text-xs text-gray-300 truncate">{rel.paper_b.title}</span>
              </div>
            </div>
            <div className={`flex-shrink-0 px-2 py-1 rounded-lg ${simBg}`}>
              <span className={`text-sm font-bold ${simColor}`}>
                {Math.round(rel.similarity * 100)}%
              </span>
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 border-t border-white/5 pt-3">
            <p className="text-xs text-gray-400 leading-relaxed mb-3">{explanation}</p>
            {rel.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => resolve(rel.id, 'approved')}
                  className="flex-1 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-colors"
                >
                  {labels.approve}
                </button>
                <button
                  onClick={() => resolve(rel.id, 'rejected')}
                  className="flex-1 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors"
                >
                  {labels.reject}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-400/20 text-yellow-400 font-medium">
          {pending.length} {labels.pending}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="text-center mt-8">
            <div className="w-6 h-6 mx-auto rounded-full border-2 border-t-transparent border-cyan-400 animate-spin mb-2" />
            <p className="text-gray-500 text-sm">{labels.loading}</p>
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center mt-8">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-gray-500 text-sm">{labels.noPending}</p>
          </div>
        ) : (
          pending.map(rel => <RelationCard key={rel.id} rel={rel} />)
        )}

        {resolved.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{labels.resolved}</p>
            </div>
            {resolved.map(rel => (
              <div key={rel.id} className="relative">
                <RelationCard rel={rel} />
                <div className={`absolute inset-0 rounded-xl pointer-events-none flex items-center justify-center ${
                  rel.status === 'approved' ? 'bg-green-900/20' : 'bg-red-900/20'
                }`}>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    rel.status === 'approved'
                      ? 'bg-green-500/30 text-green-300'
                      : 'bg-red-500/30 text-red-300'
                  }`}>
                    {rel.status === 'approved' ? labels.approved : labels.rejected}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
