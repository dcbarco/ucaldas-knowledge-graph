// Tipos del grafo — compartidos con KnowledgeGraph.tsx
export interface KGNodeData {
  id: string
  type: 'paper' | 'concept'
  label: string          // título corto para display en el grafo
  // paper
  title?: string
  title_en?: string
  department?: string
  departmentColor?: string
  year?: number
  authors?: string[]
  abstract_es?: string
  abstract_en?: string
  connectionCount?: number
  // concept
  name_es?: string
  name_en?: string
  slug?: string
  paper_count?: number
  concept_type?: 'method' | 'theme' | 'theory' | 'field'
  summary_es?: string
}

export interface KGLinkData {
  source: string
  target: string
  similarity: number
  relation_type: 'semantic' | 'methodological' | 'thematic'
  link_type: 'relation' | 'paper_concept'
  explanation_es?: string
}

// Colores exactos del spec §10.2 — sincronizados con seed.sql
export const DEPT_COLORS: Record<string, string> = {
  'Artes y Humanidades':                '#EF4444',
  'Ciencias Agropecuarias':             '#84CC16',
  'Ciencias Exactas y Naturales':       '#06B6D4',
  'Ciencias Jurídicas y Sociales':      '#8B5CF6',
  'Ciencias para la Salud':             '#10B981',
  'Inteligencia Artificial e Ingenierías': '#F59E0B',
}

const C = DEPT_COLORS

export const MOCK_NODES: KGNodeData[] = [
  // ── Papers ───────────────────────────────────────────────────
  {
    id: 'p1', type: 'paper',
    label: 'Etnografía Digital',
    title: 'Etnografía digital en comunidades virtuales colombianas',
    title_en: 'Digital Ethnography in Colombian Virtual Communities',
    department: 'Artes y Humanidades', departmentColor: C['Artes y Humanidades'],
    year: 2023, authors: ['García, M.', 'López, S.'],
    abstract_es: 'Estudio de comunidades digitales mediante metodología etnográfica en redes sociales colombianas.',
    abstract_en: 'Study of digital communities using ethnographic methodology on Colombian social networks.',
    connectionCount: 3,
  },
  {
    id: 'p2', type: 'paper',
    label: 'Riego Inteligente Café',
    title: 'Sistemas de riego inteligente para cultivos de café en Caldas',
    title_en: 'Smart Irrigation for Coffee Crops in Caldas',
    department: 'Ciencias Agropecuarias', departmentColor: C['Ciencias Agropecuarias'],
    year: 2022, authors: ['Montoya, C.', 'Reyes, A.'],
    abstract_es: 'Aplicación de IoT y sensores para optimizar consumo de agua en cafetales del departamento.',
    abstract_en: 'IoT and sensor application to optimize water consumption in coffee plantations.',
    connectionCount: 4,
  },
  {
    id: 'p3', type: 'paper',
    label: 'Biodiversidad Humedales',
    title: 'Biodiversidad en humedales altoandinos de Caldas',
    title_en: 'Biodiversity in High-Andean Wetlands of Caldas',
    department: 'Ciencias Exactas y Naturales', departmentColor: C['Ciencias Exactas y Naturales'],
    year: 2023, authors: ['Vargas, P.', 'Cárdenas, L.'],
    abstract_es: 'Inventario y análisis de biodiversidad en ecosistemas de humedal altoandino.',
    abstract_en: 'Inventory and analysis of biodiversity in high-Andean wetland ecosystems.',
    connectionCount: 2,
  },
  {
    id: 'p4', type: 'paper',
    label: 'Justicia Rural',
    title: 'Acceso a la justicia en zonas rurales de Caldas',
    title_en: 'Access to Justice in Rural Areas of Caldas',
    department: 'Ciencias Jurídicas y Sociales', departmentColor: C['Ciencias Jurídicas y Sociales'],
    year: 2021, authors: ['Osorio, F.', 'Bermúdez, C.'],
    abstract_es: 'Análisis de las barreras de acceso al sistema judicial en comunidades rurales.',
    abstract_en: 'Analysis of barriers to judicial system access in rural communities.',
    connectionCount: 3,
  },
  {
    id: 'p5', type: 'paper',
    label: 'Enfermedades Crónicas',
    title: 'Prevalencia de enfermedades crónicas en adultos mayores rurales',
    title_en: 'Chronic Disease Prevalence in Rural Older Adults',
    department: 'Ciencias para la Salud', departmentColor: C['Ciencias para la Salud'],
    year: 2022, authors: ['Herrera, N.', 'Tobón, J.'],
    abstract_es: 'Estudio epidemiológico sobre enfermedades crónicas no transmisibles en poblaciones rurales mayores.',
    abstract_en: 'Epidemiological study on chronic non-communicable diseases in rural older populations.',
    connectionCount: 4,
  },
  {
    id: 'p6', type: 'paper',
    label: 'IA Detección Plagas',
    title: 'Redes neuronales para detección temprana de plagas en café',
    title_en: 'Neural Networks for Early Pest Detection in Coffee',
    department: 'Inteligencia Artificial e Ingenierías', departmentColor: C['Inteligencia Artificial e Ingenierías'],
    year: 2023, authors: ['Ríos, D.', 'Salazar, M.'],
    abstract_es: 'Sistema de visión computacional para identificar plagas en etapas tempranas.',
    abstract_en: 'Computer vision system to identify pests in early stages.',
    connectionCount: 5,
  },
  {
    id: 'p7', type: 'paper',
    label: 'Suelos Cafeteros',
    title: 'Análisis espectral de suelos cafeteros en el Eje Cafetero',
    title_en: 'Spectral Analysis of Coffee Soils in the Coffee Region',
    department: 'Ciencias Agropecuarias', departmentColor: C['Ciencias Agropecuarias'],
    year: 2021, authors: ['Muñoz, T.', 'Giraldo, H.'],
    abstract_es: 'Caracterización de suelos mediante espectroscopía para mejorar el rendimiento del café.',
    abstract_en: 'Soil characterization via spectroscopy to improve coffee yield.',
    connectionCount: 3,
  },
  {
    id: 'p8', type: 'paper',
    label: 'Telemedicina Rural',
    title: 'Telemedicina para comunidades rurales dispersas de Caldas',
    title_en: 'Telemedicine for Dispersed Rural Communities in Caldas',
    department: 'Ciencias para la Salud', departmentColor: C['Ciencias para la Salud'],
    year: 2023, authors: ['Castaño, R.', 'Echeverri, L.'],
    abstract_es: 'Implementación y evaluación de sistemas de atención médica remota en zonas de difícil acceso.',
    abstract_en: 'Implementation and evaluation of remote medical care in hard-to-reach areas.',
    connectionCount: 3,
  },
  // ── Concept Nodes (wiki) ──────────────────────────────────────
  {
    id: 'c1', type: 'concept',
    label: 'Metodología Mixta',
    name_es: 'Metodología Mixta', name_en: 'Mixed Methods',
    slug: 'metodologia-mixta', paper_count: 5,
    concept_type: 'method',
    summary_es: 'Enfoque de investigación que combina métodos cualitativos y cuantitativos.',
  },
  {
    id: 'c2', type: 'concept',
    label: 'Tecnología Rural',
    name_es: 'Tecnología Rural', name_en: 'Rural Technology',
    slug: 'tecnologia-rural', paper_count: 4,
    concept_type: 'theme',
    summary_es: 'Aplicación de tecnologías modernas en contextos rurales colombianos.',
  },
  {
    id: 'c3', type: 'concept',
    label: 'Sostenibilidad',
    name_es: 'Sostenibilidad Ambiental', name_en: 'Environmental Sustainability',
    slug: 'sostenibilidad', paper_count: 3,
    concept_type: 'theme',
    summary_es: 'Marco de análisis de impacto ambiental y prácticas sostenibles en ecosistemas.',
  },
  {
    id: 'c4', type: 'concept',
    label: 'Machine Learning',
    name_es: 'Aprendizaje Automático', name_en: 'Machine Learning',
    slug: 'machine-learning', paper_count: 3,
    concept_type: 'method',
    summary_es: 'Técnicas de IA para clasificación y predicción de patrones en datos agrícolas y médicos.',
  },
  {
    id: 'c5', type: 'concept',
    label: 'Comunidades Rurales',
    name_es: 'Comunidades Rurales', name_en: 'Rural Communities',
    slug: 'comunidades-rurales', paper_count: 6,
    concept_type: 'field',
    summary_es: 'Contexto sociocultural de poblaciones rurales caldenses como objeto de estudio.',
  },
  {
    id: 'c6', type: 'concept',
    label: 'Salud Digital',
    name_es: 'Salud Digital', name_en: 'Digital Health',
    slug: 'salud-digital', paper_count: 2,
    concept_type: 'field',
    summary_es: 'Uso de tecnologías digitales para mejorar la atención y el acceso a servicios de salud.',
  },
]

export const MOCK_LINKS: KGLinkData[] = [
  // ── Relaciones paper ↔ paper (aprobadas) ─────────────────────
  {
    source: 'p2', target: 'p6',
    similarity: 0.88, relation_type: 'methodological', link_type: 'relation',
    explanation_es: 'Ambos aplican IA y sensores en contexto agrícola cafetero',
  },
  {
    source: 'p2', target: 'p7',
    similarity: 0.82, relation_type: 'thematic', link_type: 'relation',
    explanation_es: 'Comparten foco en optimización de cultivos de café en Caldas',
  },
  {
    source: 'p5', target: 'p8',
    similarity: 0.79, relation_type: 'thematic', link_type: 'relation',
    explanation_es: 'Convergen en atención a salud de poblaciones rurales mayores',
  },
  {
    source: 'p6', target: 'p3',
    similarity: 0.74, relation_type: 'methodological', link_type: 'relation',
    explanation_es: 'Comparten análisis de datos biológicos mediante machine learning',
  },
  {
    source: 'p1', target: 'p4',
    similarity: 0.71, relation_type: 'semantic', link_type: 'relation',
    explanation_es: 'Ambos estudian comunidades vulnerables con metodología cualitativa',
  },
  {
    source: 'p4', target: 'p5',
    similarity: 0.68, relation_type: 'thematic', link_type: 'relation',
    explanation_es: 'Convergen en análisis de exclusión social en zonas rurales de Caldas',
  },
  {
    source: 'p7', target: 'p3',
    similarity: 0.76, relation_type: 'methodological', link_type: 'relation',
    explanation_es: 'Comparten análisis espectral y caracterización de ecosistemas naturales',
  },
  {
    source: 'p8', target: 'p6',
    similarity: 0.65, relation_type: 'semantic', link_type: 'relation',
    explanation_es: 'Ambos aplican tecnología digital para superar barreras de acceso rural',
  },
  // ── Vínculos paper ↔ concept (wiki) ──────────────────────────
  { source: 'p2', target: 'c2', similarity: 0.9, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p6', target: 'c2', similarity: 0.85, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p7', target: 'c2', similarity: 0.8, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p6', target: 'c4', similarity: 0.92, relation_type: 'methodological', link_type: 'paper_concept' },
  { source: 'p3', target: 'c3', similarity: 0.88, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p2', target: 'c3', similarity: 0.75, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p5', target: 'c5', similarity: 0.87, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p4', target: 'c5', similarity: 0.83, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p1', target: 'c5', similarity: 0.79, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p8', target: 'c6', similarity: 0.91, relation_type: 'thematic', link_type: 'paper_concept' },
  { source: 'p5', target: 'c1', similarity: 0.78, relation_type: 'methodological', link_type: 'paper_concept' },
  { source: 'p1', target: 'c1', similarity: 0.82, relation_type: 'methodological', link_type: 'paper_concept' },
]

export const MOCK_STATS = {
  papers: MOCK_NODES.filter(n => n.type === 'paper').length,
  relations: MOCK_LINKS.filter(l => l.link_type === 'relation').length,
  concepts: MOCK_NODES.filter(n => n.type === 'concept').length,
}
