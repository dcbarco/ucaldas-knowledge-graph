'use client'

import { useState } from 'react'

interface ConceptNode {
  id: string
  slug: string
  title: string
  summary: string
  paper_count: number
  keywords: string[]
  last_updated: Date
}

const MOCK_CONCEPTS: ConceptNode[] = [
  {
    id: 'c1',
    slug: 'machine_learning',
    title: 'Machine Learning',
    summary: 'Conjunto de técnicas que permiten a los sistemas aprender de datos y mejorar automáticamente con la experiencia. Incluye aprendizaje supervisado, no supervisado y por refuerzo.',
    paper_count: 4,
    keywords: ['redes neuronales', 'clasificación', 'regresión', 'clustering', 'deep learning'],
    last_updated: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'c2',
    slug: 'biodiversidad',
    title: 'Biodiversidad',
    summary: 'Variedad y variabilidad de los organismos vivos en ecosistemas terrestres y acuáticos de Colombia. Incluye diversidad genética, de especies y de ecosistemas.',
    paper_count: 3,
    keywords: ['ecosistemas', 'flora', 'fauna', 'conservación', 'endemismo'],
    last_updated: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    id: 'c3',
    slug: 'procesamiento_nlp',
    title: 'Procesamiento de Lenguaje Natural',
    summary: 'Técnicas computacionales para analizar, comprender y generar lenguaje humano. Abarca desde análisis sintáctico hasta modelos de lenguaje de gran escala.',
    paper_count: 2,
    keywords: ['transformers', 'tokenización', 'embeddings', 'semántica', 'LLM'],
    last_updated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'c4',
    slug: 'salud_publica',
    title: 'Salud Pública',
    summary: 'Disciplina que estudia y promueve la salud de las poblaciones mediante la prevención de enfermedades, la vigilancia epidemiológica y las políticas sanitarias.',
    paper_count: 2,
    keywords: ['epidemiología', 'prevención', 'diagnóstico', 'intervención', 'comunidad'],
    last_updated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'c5',
    slug: 'agricultura_sostenible',
    title: 'Agricultura Sostenible',
    summary: 'Prácticas agrícolas que buscan mantener la productividad a largo plazo mientras preservan el medio ambiente. Incluye agricultura de precisión y agroecología.',
    paper_count: 2,
    keywords: ['hidroponía', 'permacultura', 'suelos', 'riego', 'biodiversidad agrícola'],
    last_updated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'c6',
    slug: 'derechos_humanos',
    title: 'Derechos Humanos',
    summary: 'Marco jurídico y filosófico sobre los derechos inherentes a todos los seres humanos. Incluye análisis de marcos legales nacionales e internacionales.',
    paper_count: 1,
    keywords: ['justicia', 'equidad', 'legislación', 'constitución', 'garantías'],
    last_updated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
]

function formatDate(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)}d`
}

interface WikiExplorerProps {
  lang: 'es' | 'en'
}

export default function WikiExplorer({ lang }: WikiExplorerProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ConceptNode | null>(null)

  const filtered = MOCK_CONCEPTS.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.slug.includes(query.toLowerCase()) ||
    c.keywords.some(k => k.includes(query.toLowerCase()))
  )

  const labels = {
    title:       lang === 'es' ? 'Explorador de Wiki'     : 'Wiki Explorer',
    search:      lang === 'es' ? 'Buscar conceptos...'    : 'Search concepts...',
    noResults:   lang === 'es' ? 'Sin resultados'         : 'No results',
    papers:      lang === 'es' ? 'artículos'              : 'papers',
    updated:     lang === 'es' ? 'Actualizado'            : 'Updated',
    keywords:    lang === 'es' ? 'Palabras clave'         : 'Keywords',
    back:        lang === 'es' ? '← Volver'               : '← Back',
    concepts:    lang === 'es' ? 'conceptos'              : 'concepts',
  }

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-cyan-400 hover:text-cyan-300 mb-4 flex-shrink-0 text-left"
        >
          {labels.back}
        </button>
        <div className="flex-1 overflow-y-auto">
          <div className="mb-1">
            <span className="text-xs font-mono text-gray-500">{selected.slug}</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{selected.title}</h3>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
              {selected.paper_count} {labels.papers}
            </span>
            <span className="text-xs text-gray-500">
              {labels.updated} {formatDate(selected.last_updated)}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed mb-6">{selected.summary}</p>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {labels.keywords}
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.keywords.map(kw => (
                <span
                  key={kw}
                  className="text-xs px-2 py-1 rounded-lg bg-white/10 text-gray-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
        <span className="text-xs text-gray-500">{MOCK_CONCEPTS.length} {labels.concepts}</span>
      </div>

      <div className="relative mb-4 flex-shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={labels.search}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/60"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center mt-8">{labels.noResults}</p>
        ) : (
          filtered.map(concept => (
            <button
              key={concept.id}
              onClick={() => setSelected(concept)}
              className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors truncate">
                      {concept.title}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 pl-4">{concept.summary}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
                    {concept.paper_count}
                  </span>
                  <span className="text-xs text-gray-600">{formatDate(concept.last_updated)}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
