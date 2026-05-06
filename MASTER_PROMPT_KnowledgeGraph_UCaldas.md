# 🧬 PROMPT MAESTRO — Knowledge Graph Interactivo
## Universidad de Caldas · Red de Investigación Interdepartamental

> **Instrucciones para Claude Code:** Este documento es el brief técnico y funcional completo del proyecto. Léelo en su totalidad antes de escribir una sola línea de código. Cada sección es vinculante. Ante dudas de implementación, prioriza siempre: experiencia táctil → fidelidad visual → rendimiento → organización del código.

---

## 1. VISIÓN DEL PROYECTO

Construir una **webapp interactiva tipo kiosko de pantalla táctil vertical** que visualiza, en tiempo real y de forma animada, las relaciones entre investigaciones (papers académicos en PDF) de los distintos departamentos de la **Universidad de Caldas (Colombia)**.

El objetivo institucional es **revelar conexiones interdisciplinares que quizás nunca se han formalizado**, dando visibilidad a la riqueza investigativa de la universidad como un organismo vivo e interconectado.

### 1.1 Principio Fundamental: Conocimiento Acumulativo (no RAG)

> ⚠️ **Esta distinción es crítica para la arquitectura. No ignorar.**

La mayoría de sistemas con IA y documentos funcionan como **RAG** (Retrieval-Augmented Generation): suben archivos, recuperan fragmentos relevantes en cada consulta, y la IA deriva respuestas desde cero cada vez. **Este proyecto NO es eso.**

Este sistema construye y mantiene una **capa de conocimiento persistente y acumulativa** — una wiki estructurada que vive entre los PDFs crudos y el grafo visual. Cuando se ingesta un nuevo paper, la IA no solo lo indexa para búsquedas futuras: lo lee, extrae su conocimiento, y lo **integra** en la base de conocimiento existente — actualizando nodos de conceptos compartidos, detectando contradicciones, fortaleciendo o matizando conexiones ya establecidas.

**La diferencia clave:** el conocimiento se compila una vez y se *mantiene vigente*, no se re-deriva en cada consulta. Las interconexiones ya están allí. Las síntesis entre departamentos ya están construidas. La wiki se vuelve más rica con cada paper añadido.

```
❌ Sistema RAG (lo que NO es esto):
   PDF → índice de chunks → consulta → LLM re-deriva respuesta cada vez
   Resultado: conocimiento plano, no acumulativo

✅ Este sistema (LLM Wiki + Knowledge Graph):
   PDF → wiki de conocimiento persistente → grafo visual acumulativo
   Resultado: síntesis que crece, conexiones que perduran, comprensión compuesta
```

### 1.2 Las Tres Capas del Sistema

```
CAPA 1 — FUENTES CRUDAS (inmutable)
  PDFs en Supabase Storage
  Nunca se modifican. Son la fuente de verdad.

CAPA 2 — WIKI DE CONOCIMIENTO (dinámica, mantenida por IA)
  Nodos de conceptos, metodologías, temas
  Síntesis entre papers y departamentos
  Contradicciones detectadas, convergencias identificadas
  La IA escribe y actualiza esta capa; el admin la modera.

CAPA 3 — GRAFO VISUAL (representación de la Capa 2)
  Lo que ve el usuario en el kiosko
  Nodos = papers + nodos de concepto compartido
  Aristas = relaciones entre papers mediadas por la wiki
  Animación micelio = crecimiento vivo de la Capa 2
```

---

## 2. CONTEXTO Y RESTRICCIONES CLAVE

| Parámetro | Valor |
|---|---|
| Dispositivo objetivo | Pantalla táctil vertical (kiosko/lobby/museo) |
| Orientación | Portrait vertical (aprox. 1080×1920px o similar 9:16) |
| Usuarios | Público general (visitantes, estudiantes, docentes) |
| Idioma de interfaz | Bilingüe: Español / Inglés (toggle) |
| Papers iniciales | ~10–20 PDFs como corpus de prueba |
| Hosting | Vercel (frontend) + Railway (backend/workers) |
| Presupuesto IA | Flexible — diseñar para ser costo-eficiente; soportar múltiples providers |
| Autenticación admin | PIN numérico oculto en el mismo kiosko (no panel separado) |
| Control de relaciones | Semi-automático: IA propone → admin aprueba/rechaza/edita |

---

## 3. STACK TECNOLÓGICO

### 3.1 Frontend
```
Next.js 14+ (App Router)          → Framework principal, SSR/SSG, rutas API
React 18+                         → UI components
TypeScript                        → Tipado estricto en todo el proyecto
Tailwind CSS + shadcn/ui          → Sistema de diseño y componentes base
Framer Motion                     → Animaciones de UI, modales, transiciones
react-force-graph-2d              → Motor principal del Knowledge Graph (WebGL, D3-force)
  └─ Usa: d3-force, three.js internamente
  └─ Soporta: touch events, zoom, pan, node drag
```

> **Por qué `react-force-graph-2d`:** Renderiza en Canvas/WebGL (óptimo para kiosko), soporta miles de nodos, tiene API para animaciones personalizadas por arista y nodo, y maneja eventos táctiles nativamente. Es la mejor opción para este caso de uso específico.

### 3.2 Backend & Base de Datos
```
Next.js API Routes                → Endpoints REST para la webapp
Supabase                          → PostgreSQL + Storage (PDFs) + Auth + Realtime
  └─ pgvector extension           → Almacenamiento y búsqueda de embeddings
  └─ Supabase Storage             → Almacenamiento de archivos PDF
  └─ Supabase Realtime            → Push de nuevas relaciones al frontend (WebSocket)
```

### 3.3 Workers / Procesamiento Asíncrono
```
Railway (worker service)          → Proceso independiente para tareas largas
  └─ Bull / BullMQ + Redis        → Cola de trabajos para procesamiento de PDFs
  └─ pdf-parse                    → Extracción de texto desde PDFs
```

> El procesamiento de un paper es asíncrono y NO bloquea la UI. El kiosko observa el progreso via Supabase Realtime.

### 3.4 Capa de IA — Estrategia de Proveedores Gratuitos

> **Principio de diseño:** La capa de IA usa una arquitectura de adaptadores intercambiables.
> Todos los proveedores seleccionados son gratuitos, legítimos, y compatibles con la API de OpenAI —
> lo que significa que el mismo adaptador base funciona para todos cambiando solo `baseURL` y `apiKey`.

#### Mapa de proveedores por tarea

| Tarea en el pipeline | Proveedor primario | Proveedor de respaldo | Notas |
|---|---|---|---|
| **Embeddings** | GitHub Models (`text-embedding-3-small`) | Scaleway (`qwen3-embedding-8b`) | Mismo modelo especificado en el prompt. Solo cambiar `baseURL`. |
| **Extracción de conceptos** | OpenRouter → `llama-3.3-70b:free` | Cerebras (`llama-3.3-70b`) | OpenRouter ya disponible. |
| **Síntesis / actualización wiki** | OpenRouter → `deepseek-r1:free` | Groq (`llama-3.3-70b`) | DeepSeek R1 es excelente para razonamiento complejo. |
| **Explicación de relaciones** | OpenRouter → `llama-3.3-70b:free` | Groq (`llama-3.1-8b`) | Tarea de mediana complejidad. |
| **Tareas rápidas** (slugs, tipos) | Groq (`llama-3.1-8b`) | Cerebras (`llama-3.1-8b`) | 14,400 req/día, ultra-rápido. |
| **❌ Evitar** | Google AI Studio | — | Datos de entrenamiento con papers colombianos = problema de propiedad intelectual. |

#### Por qué OpenRouter es el hub principal

OpenRouter unifica acceso a todos los modelos gratuitos bajo **una sola API key y un solo endpoint**.
En lugar de gestionar 3–4 keys distintas desde el inicio, OpenRouter actúa como router:
- Si un modelo está caído o llega al límite, cambia automáticamente.
- Soporta `llama-3.3-70b:free`, `deepseek-r1:free`, `gemma-3-27b:free` y más de 30 modelos sin costo.
- API 100% compatible con OpenAI — un solo adaptador para todo.

```
Límites OpenRouter (plan gratuito):
  20 requests/minuto
  50 requests/día (sin topup)
  Hasta 1,000 requests/día con $10 de crédito de por vida (topup único)
```

> ⚠️ **Recomendación:** Hacer el topup de $10 en OpenRouter. Da acceso a 1,000 req/día que
> es más que suficiente para el proyecto completo, y los modelos gratuitos no consumen ese crédito.

#### Modelos recomendados en OpenRouter (todos `:free`)

```
Para razonamiento complejo (síntesis wiki, análisis conceptual):
  deepseek/deepseek-r1:free          → Mejor razonamiento, ideal para wiki updates
  moonshotai/kimi-k2:free            → Excelente en análisis de documentos largos

Para tareas estándar (extracción, resúmenes, relaciones):
  meta-llama/llama-3.3-70b-instruct:free   → Equilibrio perfecto calidad/velocidad
  google/gemma-3-27b-it:free               → Bueno para contenido bilingüe ES/EN

Para tareas rápidas (clasificación, slugs):
  meta-llama/llama-3.2-3b-instruct:free   → Mínimo costo de tokens, ultra-rápido
```

**Interfaz de adaptador (implementar desde el inicio):**
```typescript
interface AIProvider {
  generateEmbedding(text: string): Promise<number[]>
  extractConcepts(text: string): Promise<PaperConcepts>
  summarize(text: string, lang: 'es' | 'en'): Promise<string>
  updateWikiNode(existing: string, newContext: string): Promise<WikiUpdate>
  explainRelation(paperA: PaperMeta, paperB: PaperMeta, shared: string[]): Promise<RelationExplanation>
}

// Todos los proveedores usan OpenAI SDK con baseURL distinta:
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
    'X-Title': 'Knowledge Graph UC'
  }
})

const cerebras = new OpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY
})

const groq = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY
})

// Embeddings via GitHub Models (mismo SDK de OpenAI):
const githubModels = new OpenAI({
  baseURL: 'https://models.inference.ai.azure.com',
  apiKey: process.env.GITHUB_TOKEN
})
```

#### Lógica de fallback automático

```typescript
// lib/ai/router.ts — Elegir proveedor según tarea y disponibilidad
async function routeRequest(task: AITask): Promise<AIResponse> {
  const providers = PROVIDER_PRIORITY[task.type]  // orden de preferencia por tipo
  for (const provider of providers) {
    try {
      return await provider.execute(task)
    } catch (err) {
      if (isRateLimitError(err)) continue  // intentar siguiente provider
      throw err
    }
  }
  throw new Error('All AI providers exhausted for task: ' + task.type)
}

const PROVIDER_PRIORITY: Record<TaskType, Provider[]> = {
  embedding:          [githubModels, scaleway],
  extract_concepts:   [openrouter, cerebras, groq],
  wiki_update:        [openrouter, cerebras],
  explain_relation:   [openrouter, groq, cerebras],
  quick_classify:     [groq, openrouter, cerebras],
}
```

### 3.5 Almacenamiento de PDFs
```
Supabase Storage                  → Bucket privado "papers"
  └─ Acceso firmado por tiempo    → URLs temporales para lectura
  └─ Metadata en PostgreSQL       → Título, autor, año, departamento, resumen
```

---

## 4. MODELO DE DATOS

### Tabla: `papers`
```sql
id              UUID PRIMARY KEY
title           TEXT NOT NULL
authors         TEXT[]
department      TEXT NOT NULL          -- Facultad/Departamento
year            INTEGER
abstract_es     TEXT                   -- Resumen en español
abstract_en     TEXT                   -- Resumen en inglés
language        TEXT                   -- 'es' | 'en' | 'both'
pdf_url         TEXT                   -- URL firmada Supabase Storage
pdf_path        TEXT                   -- Path interno en bucket
full_text       TEXT                   -- Texto extraído del PDF
embedding       vector(1536)           -- pgvector embedding del contenido
concepts        JSONB                  -- { methods: [], themes: [], keywords: [] }
status          TEXT                   -- 'processing' | 'ready' | 'error'
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### Tabla: `relations`
```sql
id              UUID PRIMARY KEY
paper_a_id      UUID REFERENCES papers(id)
paper_b_id      UUID REFERENCES papers(id)
similarity      FLOAT                  -- Score de similitud coseno (0.0 - 1.0)
relation_type   TEXT                   -- 'semantic' | 'methodological' | 'thematic'
shared_concepts JSONB                  -- Conceptos que comparten
explanation_es  TEXT                   -- Explicación IA en español
explanation_en  TEXT                   -- Explicación IA en inglés
status          TEXT                   -- 'proposed' | 'approved' | 'rejected'
proposed_at     TIMESTAMPTZ
approved_at     TIMESTAMPTZ
approved_by     TEXT                   -- 'admin'
```

### Tabla: `departments`
```sql
id              UUID PRIMARY KEY
name_es         TEXT
name_en         TEXT
color           TEXT                   -- Color HEX para el cluster en el grafo
icon            TEXT                   -- Emoji o slug de ícono
```

### Tabla: `processing_jobs`
```sql
id              UUID PRIMARY KEY
paper_id        UUID REFERENCES papers(id)
status          TEXT                   -- 'queued' | 'extracting' | 'embedding' | 'relating' | 'wiki_update' | 'done' | 'error'
progress        INTEGER                -- 0-100
current_step    TEXT                   -- Descripción del paso actual
error_message   TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### Tabla: `concept_nodes` ← CAPA WIKI
```sql
id              UUID PRIMARY KEY
slug            TEXT UNIQUE NOT NULL   -- 'analisis-redes-sociales', 'etnografia', etc.
name_es         TEXT NOT NULL          -- Nombre canónico en español
name_en         TEXT NOT NULL          -- Canonical name in English
type            TEXT                   -- 'method' | 'theme' | 'theory' | 'field'
summary_es      TEXT                   -- Síntesis acumulada en español (IA la actualiza)
summary_en      TEXT                   -- Accumulated synthesis in English
paper_count     INTEGER DEFAULT 0      -- Cuántos papers lo mencionan
embedding       vector(1536)           -- Para búsqueda semántica de conceptos
first_seen_at   TIMESTAMPTZ
last_updated_at TIMESTAMPTZ
```

### Tabla: `paper_concepts` ← Relación papers ↔ concept_nodes
```sql
paper_id        UUID REFERENCES papers(id)
concept_id      UUID REFERENCES concept_nodes(id)
relevance       FLOAT                  -- Qué tan central es el concepto en el paper (0-1)
context_es      TEXT                   -- Cómo usa este paper el concepto (en español)
context_en      TEXT                   -- How this paper uses the concept
PRIMARY KEY (paper_id, concept_id)
```

### Tabla: `wiki_log` ← Registro append-only de operaciones
```sql
id              UUID PRIMARY KEY
event_type      TEXT                   -- 'ingest' | 'relation_approved' | 'concept_updated' | 'lint'
title           TEXT                   -- Título descriptivo del evento
details         JSONB                  -- Detalles del evento (paper_id, concepts_updated, etc.)
created_at      TIMESTAMPTZ
```

> **Formato del log:** Cada entrada en `wiki_log` sigue el patrón:
> `[FECHA] | [TIPO] | [TÍTULO]`
> Ejemplo: `2026-05-15 | ingest | "Análisis de redes en educación rural" — 3 conceptos nuevos, 7 relaciones propuestas`

---

## 5. ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────┐
│                 CAPA 3: KIOSKO (Vercel)                      │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐  │
│  │  Vista Pública│    │       Knowledge Graph Canvas     │  │
│  │  (Graph View) │    │   react-force-graph-2d + WebGL   │  │
│  └──────┬───────┘    └──────────────┬───────────────────┘  │
│         │ Supabase Realtime          │                       │
└─────────│──────────────────────────-│───────────────────────┘
          │                           │
┌─────────▼───────────────────────────▼───────────────────────┐
│              CAPA 2: WIKI DE CONOCIMIENTO (Supabase)         │
│                                                             │
│  papers ──────────────── paper_concepts ──── concept_nodes  │
│  relations (aprobadas)                       wiki_log        │
│  pgvector embeddings     Síntesis IA         (append-only)  │
│                                                             │
│  ← La IA escribe aquí. El admin modera. El kiosko lee.      │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│     WORKER (Railway) — Pipeline de Ingestión                 │
│                                                             │
│  BullMQ Jobs:                                               │
│  1. extract_text         → pdf-parse → full_text            │
│  2. generate_embedding   → AI Provider → vector[1536]        │
│  3. extract_concepts     → LLM → concepts JSON              │
│  4. update_wiki          → upsert concept_nodes ← NUEVO     │
│  5. find_relations       → pgvector similarity search        │
│  6. explain_relations    → LLM → explanations               │
│  7. propose_relations    → INSERT relations (proposed)       │
│  8. log_and_notify       → wiki_log + Realtime broadcast     │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│              CAPA 1: FUENTES CRUDAS (Supabase Storage)       │
│                     PDFs — INMUTABLES                        │
└─────────────────────────────────────────────────────────────┘
```

```

---

## 6. PIPELINE DE PROCESAMIENTO DE UN PAPER (INGESTIÓN)

Cuando el admin sube un PDF, se dispara este pipeline asíncrono en el worker. Cada paso actualiza `processing_jobs` con progreso, visible en tiempo real en el kiosko.

```
PASO 1 — EXTRACCIÓN DE TEXTO                               [10%]
  pdf-parse → full_text
  Actualiza: papers.status = 'processing'

PASO 2 — RESUMEN Y CONCEPTOS                               [30%]
  LLM extrae en JSON:
    summary_es / summary_en, methods[], themes[], keywords[], field
  Actualiza: papers.abstract_es, abstract_en, concepts

PASO 3 — EMBEDDING                                         [50%]
  AI Provider: full_text → vector[1536]
  Actualiza: papers.embedding

PASO 4 — ACTUALIZACIÓN DE LA WIKI  ← PASO NUEVO           [65%]
  Para cada concepto/método/tema extraído en el Paso 2:
    a) Buscar si ya existe un concept_node con ese nombre (fuzzy match)
    b) Si existe: actualizar summary con nueva información del paper
       (LLM: "Integra este nuevo paper al resumen existente del concepto X")
    c) Si no existe: crear nuevo concept_node con resumen inicial
    d) Crear/actualizar paper_concepts (paper ↔ concepto con relevance score)
  Registra en wiki_log: cuántos conceptos nuevos vs actualizados
  ⚠️ Los embeddings de concept_nodes se regeneran al actualizar

PASO 5 — BÚSQUEDA DE RELACIONES                            [80%]
  Búsqueda dual en pgvector:
    A) Por embedding de paper (similitud directa entre papers)
    B) Por concept_nodes compartidos (papers que comparten wikis)
  Combinar y deduplicar resultados
  Filtro: similarity > SIMILARITY_THRESHOLD (default 0.72)
  Máximo 10 relaciones propuestas por paper

PASO 6 — EXPLICACIÓN DE RELACIONES                         [92%]
  Para cada par de relaciones encontradas, LLM genera:
    explanation_es, explanation_en, relation_type
  Contexto: usa los concept_nodes compartidos como evidencia
  INSERT INTO relations (status='proposed')

PASO 7 — LOG Y NOTIFICACIÓN                               [100%]
  Actualiza: papers.status = 'ready'
  INSERT wiki_log: { type: 'ingest', paper_id, concepts_new, concepts_updated, relations_proposed }
  Supabase Realtime broadcast → kiosko anima expansión micelio
```

**Umbral de similitud configurable:** `SIMILARITY_THRESHOLD=0.72`

---

## 6b. OPERACIONES DE LA WIKI

Inspiradas en el patrón LLM Wiki, el sistema soporta tres modos de operación sobre la base de conocimiento:

### INGESTIÓN (automática, en pipeline)
Ver Sección 6. Cada paper nuevo alimenta y enriquece la wiki.

### CONSULTA (desde admin panel)
El admin puede hacer preguntas semánticas contra la wiki acumulada:

```typescript
// Flujo de consulta:
// 1. Embed la pregunta del usuario
// 2. Buscar concept_nodes relevantes por similitud vectorial
// 3. Buscar papers relacionados con esos conceptos
// 4. LLM sintetiza respuesta con los wiki entries como contexto
// 5. Respuesta puede guardarse como nuevo concept_node (conocimiento compuesto)

interface WikiQuery {
  question: string                    // Ej: "¿Qué departamentos estudian metodologías mixtas?"
  save_as_concept?: boolean           // Si true, la síntesis se guarda en concept_nodes
  save_slug?: string                  // Slug para el nuevo nodo si se guarda
}
```

Ejemplos de consultas útiles para la administración:
- *"¿Qué metodologías son transversales a más de dos facultades?"*
- *"¿Hay investigaciones contradictorias sobre X tema?"*
- *"¿Qué áreas tienen menos conexiones y podrían beneficiarse de colaboración?"*

### LINT (mantenimiento periódico, desde admin panel)
El admin puede ejecutar un diagnóstico de salud de la wiki:

```
Verificaciones de LINT:
  □ Concept nodes sin papers asociados (huérfanos)
  □ Papers sin ninguna relación (aislados en el grafo)
  □ Relaciones con explanation muy genérica (calidad baja)
  □ Conceptos duplicados o casi-duplicados (fusionar)
  □ Papers con conceptos asignados incorrectamente
  □ Concept nodes con summaries desactualizados
     (nuevos papers los mencionan pero el summary no los incluye)
  □ Gaps temáticos: áreas mencionadas en papers pero sin concept_node propio

Output: Lista de sugerencias con acciones propuestas (admin aprueba cada una)
Log: INSERT wiki_log { type: 'lint', issues_found, issues_resolved }
```

---


## 7. FUNCIONALIDADES — VISTA PÚBLICA (KIOSKO)

### 7.1 Pantalla Principal: Knowledge Graph
- Canvas de pantalla completa con todos los papers como nodos
- Los nodos se agrupan por **cluster de departamento** (color distinto por departamento)
- Las aristas representan relaciones aprobadas (grosor proporcional a similarity score)
- **Interacciones táctiles:**
  - `Tap` en nodo → abre modal con info del paper
  - `Pinch` → zoom in/out
  - `Drag` fondo → pan por el grafo
  - `Drag` nodo → reposicionar (temporal, no persistente)
  - `Tap` en arista → muestra tooltip con explicación de la relación
- **Indicador de actividad:** cuando hay un paper siendo procesado, se muestra una animación de "pulso" en el borde del canvas indicando que el sistema está aprendiendo

### 7.2 Modal de Nodo (Paper)
Al tocar un nodo se abre un modal con:
```
┌─────────────────────────────────────────┐
│  [Departamento · Año]                   │
│                                         │
│  Título del Paper                       │
│  Autores                                │
│                                         │
│  Resumen (ES/EN toggle)                 │
│                                         │
│  Conceptos clave: [tag] [tag] [tag]     │
│                                         │
│  Conectado con N investigaciones        │
│  [Ver conexiones →]                     │
│                                         │
│  Metodologías: [tag] [tag]              │
└─────────────────────────────────────────┘
```

### 7.3 Vista de Conexiones de un Nodo
Desde el modal, al tocar "Ver conexiones":
- El grafo hace focus en el nodo seleccionado
- Resalta con animación todos sus nodos relacionados
- El resto del grafo se atenúa (efecto fog)
- Cada arista visible muestra su explanation al hacer tap

### 7.4 Toggle de Idioma
- Botón flotante ES/EN siempre visible
- Cambia: resúmenes en modales, labels de departamentos, explicaciones de relaciones

### 7.5 Indicadores del Sistema
- Contador de papers indexados
- Contador de relaciones descubiertas
- Animación de "expansión micelio" cuando llega una nueva relación vía Realtime

---

## 8. FUNCIONALIDADES — PANEL DE ADMINISTRADOR

### 8.1 Acceso
- **Gesto secreto:** Tap en 4 esquinas de la pantalla en orden específico (configurable)
  - Secuencia por defecto: Top-left → Top-right → Bottom-right → Bottom-left
- **Fallback:** PIN numérico de 6 dígitos (configurable en `.env`)
- El panel se abre como un **drawer/modal sobre el grafo** (no navega a otra página)

### 8.2 Panel de Upload de Papers
```
┌─────────────────────────────────────────┐
│  AGREGAR PAPER                          │
│                                         │
│  [Drag & Drop PDF aquí]                 │
│                                         │
│  Título: ___________________            │
│  Autores: __________________           │
│  Departamento: [Selector]               │
│  Año: ______                            │
│                                         │
│  [Subir Paper]                          │
│                                         │
│  PROCESANDO:                            │
│  ████████░░ 80% — Buscando relaciones   │
└─────────────────────────────────────────┘
```

### 8.3 Panel de Revisión de Relaciones Propuestas
Lista de relaciones con status='proposed':
```
┌─────────────────────────────────────────┐
│  RELACIONES PENDIENTES (3)              │
│                                         │
│  Paper A  ←──── 0.87 ────→  Paper B    │
│  "Ambos usan análisis de redes..."      │
│  [✓ APROBAR]  [✗ RECHAZAR]  [✏ EDITAR] │
│                                         │
│  Paper A  ←──── 0.74 ────→  Paper C    │
│  "Comparten metodología etnográfica..."  │
│  [✓ APROBAR]  [✗ RECHAZAR]  [✏ EDITAR] │
└─────────────────────────────────────────┘
```

### 8.4 Gestión de Departamentos
- CRUD de departamentos con nombre ES/EN y color asignado
- Reasignar papers a departamentos

### 8.5 Wiki Explorer (nuevo — Capa de Conocimiento)
Vista de todos los `concept_nodes` acumulados:
```
┌─────────────────────────────────────────┐
│  WIKI DE CONCEPTOS                      │
│  [🔍 Buscar concepto...]                │
│                                         │
│  📗 análisis-de-redes        8 papers  │
│     "Metodología para estudiar..."      │
│  📘 etnografía-digital       3 papers  │
│     "Aproximación cualitativa..."       │
│  📙 sistemas-complejos       5 papers  │
│     "Marco teórico que..."             │
│                                         │
│  [+ Fusionar duplicados]               │
│  [↺ Regenerar síntesis]               │
└─────────────────────────────────────────┘
```
Al tocar un concepto: ver qué papers lo comparten, editar su summary, ver su posición en el grafo.

### 8.6 Consulta Semántica a la Wiki
```
┌─────────────────────────────────────────┐
│  PREGUNTAR A LA WIKI                    │
│                                         │
│  [¿Qué metodologías son transversales?] │
│                                         │
│  💬 Respuesta IA basada en la wiki:     │
│  "Las metodologías más transversales    │
│   son X (8 depts) e Y (6 depts)..."    │
│                                         │
│  Fuentes: [paper-1] [paper-3] [paper-7] │
│                                         │
│  [💾 Guardar como concepto nuevo]       │
└─────────────────────────────────────────┘
```

### 8.7 Panel de Lint (Salud de la Wiki)
```
┌─────────────────────────────────────────┐
│  DIAGNÓSTICO DE LA WIKI                 │
│  [▶ Ejecutar diagnóstico]               │
│                                         │
│  ⚠️  2 conceptos sin papers (huérfanos) │
│  ⚠️  1 paper sin ninguna relación       │
│  ℹ️  3 posibles duplicados de conceptos  │
│  ✅  Todas las relaciones tienen         │
│      explicación                        │
│                                         │
│  [Resolver problemas →]                 │
└─────────────────────────────────────────┘
```

### 8.8 Log de Actividad
Vista del `wiki_log` en tiempo real:
```
✅ 2026-05-15 14:32 | ingest     | "Redes en educación rural" — 3 conceptos nuevos
✅ 2026-05-15 14:35 | relation   | Aprobada: Paper A ↔ Paper C (0.87)
⚡ 2026-05-15 15:01 | processing | "Biodiversidad en humedales" — paso 4/7
ℹ️  2026-05-14 09:10 | lint       | 5 problemas encontrados, 3 resueltos
```

### 8.9 Configuración del Sistema
- Umbral de similitud (`SIMILARITY_THRESHOLD`)
- Provider de IA activo (selector con estado de conexión)
- Test de conexión a providers

---

## 9. ANIMACIÓN MICELIO — ESPECIFICACIÓN TÉCNICA

Esta es la característica visual más importante del proyecto. Implementar con máxima fidelidad.

### 9.1 Concepto
Cuando se aprueba una nueva relación y el evento llega vía Supabase Realtime al kiosko:
1. Una partícula de luz comienza en el nodo origen
2. Viaja por una ruta curva (bezier) hacia el nodo destino
3. La ruta se "dibuja" progresivamente, como si una hifa de hongo estuviera creciendo
4. Puede ramificarse y explorar varios caminos antes de llegar (comportamiento orgánico)
5. Al llegar, el nodo destino pulsa y la arista queda permanentemente visible

### 9.2 Implementación con react-force-graph-2d
```typescript
// Usar el prop `linkCanvasObject` para renderizar aristas custom
// Usar `nodeCanvasObject` para renderizar nodos con glows
// Usar requestAnimationFrame para animar el "crecimiento" de la línea

// Variables de animación por arista:
interface AnimatingEdge {
  source: string
  target: string
  progress: number        // 0.0 a 1.0
  particles: Particle[]   // partículas secundarias de "exploración"
  bezierControl: Point    // punto de control de la curva
  branches: Branch[]      // ramificaciones orgánicas
}
```

### 9.3 Parámetros Visuales de la Animación
```
Velocidad de crecimiento: 0.008 por frame (~8 segundos para crecer)
Color de hifa en crecimiento: cyan bioluminiscente (#00FFFF con glow)
Color de hifa establecida: degradado según tipo de relación
  - semantic:        #8B5CF6 (violeta)
  - methodological:  #06B6D4 (cyan)
  - thematic:        #10B981 (verde esmeralda)
Glow blur: 8px, opacity 0.7
Nodo pulsación al conectar: scale 1.0 → 1.4 → 1.0, duration 600ms
Partículas de exploración: 2-4 partículas que se bifurcan y vuelven al camino principal
```

### 9.4 Activación de Animaciones
- **Nueva relación aprobada:** animación micelio completa (~8s)
- **Paper en procesamiento:** pulso lento en todo el grafo (breathing effect, opacity 0.6 → 1.0)
- **Tap en nodo:** ripple circular desde el centro del nodo
- **Carga inicial:** los nodos aparecen con stagger desde el centro, las aristas existentes se "dibujan" secuencialmente

---

## 10. DISEÑO VISUAL — ESPECIFICACIÓN ESTÉTICA

### 10.1 Concepto: "Red Neuronal Bioluminiscente"
Inspirado en: redes de micelio fúngico, visualizaciones de redes neuronales, bioluminiscencia oceánica profunda.

### 10.2 Paleta de Colores
```css
/* Fondos */
--bg-void:       #040810   /* Negro profundo del océano */
--bg-surface:    #080F1A   /* Superficie oscura de paneles */
--bg-elevated:   #0D1829   /* Modales, drawers */

/* Nodos por departamento (ejemplos — configurables en DB) */
--dept-1:        #06B6D4   /* Cyan — Ciencias */
--dept-2:        #8B5CF6   /* Violeta — Humanidades */
--dept-3:        #10B981   /* Esmeralda — Ciencias de la Salud */
--dept-4:        #F59E0B   /* Ámbar — Ingeniería */
--dept-5:        #EF4444   /* Coral — Artes */
--dept-default:  #64748B   /* Slate — Sin clasificar */

/* Nodos especiales */
--node-active:   #FFFFFF   /* Nodo seleccionado */
--node-glow:     rgba(6, 182, 212, 0.4)

/* Aristas */
--edge-semantic:       rgba(139, 92, 246, 0.6)
--edge-method:         rgba(6, 182, 212, 0.6)
--edge-thematic:       rgba(16, 185, 129, 0.6)
--edge-proposed:       rgba(255, 255, 255, 0.2) /* Punteada */

/* Tipografía */
--text-primary:  #F0F4FF
--text-secondary:#94A3B8
--text-accent:   #06B6D4
```

### 10.3 Tipografía
```
Display / Títulos:  "Space Grotesk" o "Syne" (bold, techno-orgánico)
Body / UI:          "DM Sans" o "Geist" (legible en kiosko a distancia)
Monospace / datos:  "JetBrains Mono" (scores de similitud, IDs)
Tamaños táctiles:   Mínimo 18px body, 44px touch targets
```

### 10.4 Componentes de UI
- **Nodos del grafo:** Círculos con glow exterior coloreado por departamento. Radio proporcional al número de conexiones (min 8px, max 24px)
- **Aristas:** Líneas curvas (bezier), grosor proporcional a similarity (0.5px–3px), con leve glow
- **Labels de nodos:** Aparecen al hacer hover/tap, fondo con blur glassmorphism
- **Modales:** Glassmorphism oscuro (`backdrop-filter: blur(20px)`, `background: rgba(8,15,26,0.85)`)
- **Botones admin:** Outline style con borde luminoso, sin relleno sólido

### 10.5 Layout del Kiosko (1080×1920)
```
┌─────────────────────────────┐
│  Logo UC  |  ES / EN  |  🔵 │  ← Header 80px (translúcido)
│─────────────────────────────│
│                             │
│                             │
│    KNOWLEDGE GRAPH CANVAS   │  ← 80% del alto
│         (WebGL)             │
│                             │
│                             │
│─────────────────────────────│
│  📄 42 papers · 🔗 167 rel  │  ← Footer 80px (stats en vivo)
│  ● Sistema aprendiendo...   │
└─────────────────────────────┘
```

---

## 11. RUTAS Y ESTRUCTURA DEL PROYECTO

```
/
├── app/
│   ├── page.tsx                    → Kiosko principal (grafo)
│   ├── layout.tsx                  → Layout global
│   ├── api/
│   │   ├── papers/
│   │   │   ├── route.ts            → GET (listar), POST (crear)
│   │   │   └── [id]/route.ts       → GET, PUT, DELETE
│   │   ├── relations/
│   │   │   ├── route.ts            → GET (listar propuestas)
│   │   │   └── [id]/approve/route.ts → POST aprobar
│   │   │   └── [id]/reject/route.ts  → POST rechazar
│   │   ├── concepts/
│   │   │   ├── route.ts            → GET todos los concept_nodes
│   │   │   └── [id]/route.ts       → GET, PUT (editar summary), DELETE
│   │   ├── wiki/
│   │   │   ├── query/route.ts      → POST consulta semántica a la wiki
│   │   │   ├── lint/route.ts       → POST ejecutar diagnóstico
│   │   │   └── log/route.ts        → GET historial wiki_log
│   │   ├── departments/route.ts    → CRUD departamentos
│   │   └── upload/route.ts         → POST subir PDF + encolar job
│
├── components/
│   ├── graph/
│   │   ├── KnowledgeGraph.tsx      → Componente principal del grafo
│   │   ├── GraphNode.tsx           → Renderizado custom de nodo (paper + concept)
│   │   ├── GraphEdge.tsx           → Renderizado custom de arista
│   │   ├── MyceliumAnimation.tsx   → Motor de animación micelio
│   │   └── GraphStats.tsx          → Contador papers/relaciones/conceptos
│   ├── modals/
│   │   ├── PaperModal.tsx          → Info detallada de paper
│   │   ├── ConceptModal.tsx        → Info detallada de concept_node
│   │   └── ConnectionsModal.tsx    → Vista de conexiones de un nodo
│   ├── admin/
│   │   ├── AdminDrawer.tsx         → Container del panel admin
│   │   ├── UploadPaper.tsx         → Formulario de upload
│   │   ├── RelationReview.tsx      → Revisión de relaciones propuestas
│   │   ├── WikiExplorer.tsx        → Explorador de concept_nodes
│   │   ├── WikiQuery.tsx           → Consulta semántica a la wiki
│   │   ├── WikiLint.tsx            → Diagnóstico de salud de la wiki
│   │   ├── ActivityLog.tsx         → Vista del wiki_log
│   │   ├── DepartmentManager.tsx   → CRUD departamentos
│   │   └── SystemConfig.tsx        → Configuración
│   └── ui/                         → shadcn/ui components
│
├── lib/
│   ├── ai/
│   │   ├── providers/
│   │   │   ├── openrouter.ts       → Adaptador OpenRouter (hub principal)
│   │   │   ├── github-models.ts    → Adaptador GitHub Models (embeddings)
│   │   │   ├── cerebras.ts         → Adaptador Cerebras (respaldo LLM)
│   │   │   ├── groq.ts             → Adaptador Groq (respaldo rápido)
│   │   │   └── scaleway.ts         → Adaptador Scaleway (respaldo embeddings)
│   │   ├── router.ts               → Fallback automático por tipo de tarea
│   │   ├── index.ts                → Factory: expone funciones de alto nivel
│   │   └── types.ts                → Interfaz AIProvider + TaskType
│   ├── wiki/
│   │   ├── ingest.ts               → Orquesta actualización de concept_nodes
│   │   ├── query.ts                → Búsqueda semántica + síntesis LLM
│   │   ├── lint.ts                 → Diagnóstico de salud de la wiki
│   │   └── log.ts                  → Helpers para wiki_log
│   ├── supabase/
│   │   ├── client.ts               → Supabase browser client
│   │   ├── server.ts               → Supabase server client
│   │   └── realtime.ts             → Suscripciones Realtime
│   └── utils/
│       ├── pdf.ts                  → Extracción texto PDF
│       └── touch.ts                → Helpers para gestos táctiles
│
├── worker/                         → Servicio Railway separado
│   ├── index.ts                    → Entry point BullMQ
│   ├── queues/
│   │   └── paper-processing.ts     → Definición de la cola
│   └── jobs/
│       ├── extract-text.ts         → pdf-parse → full_text
│       ├── generate-embedding.ts   → GitHub Models → vector[1536]
│       ├── extract-concepts.ts     → OpenRouter (llama-3.3-70b) → concepts JSON
│       ├── update-wiki.ts          → OpenRouter (deepseek-r1) → upsert concept_nodes
│       ├── find-relations.ts       → pgvector similarity search
│       ├── explain-relations.ts    → OpenRouter (llama-3.3-70b) → explanations
│       └── notify.ts               → wiki_log + Supabase Realtime broadcast
│
└── supabase/
    └── migrations/
        └── 001_initial.sql         → Schema completo con pgvector
```

---

## 12. VARIABLES DE ENTORNO

```bash
# ============================================================
# SUPABASE
# ============================================================
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ============================================================
# AI PROVIDERS — Arquitectura de fallback automático
# ============================================================

# OpenRouter (HUB PRINCIPAL — ya disponible)
# Endpoint único para todos los modelos gratuitos
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# GitHub Models (EMBEDDINGS — gratuito con cuenta GitHub)
# Acceso a text-embedding-3-small y text-embedding-3-large
GITHUB_TOKEN=ghp_...
GITHUB_MODELS_BASE_URL=https://models.inference.ai.azure.com

# Cerebras (RESPALDO LLM — gratuito, hardware especializado)
# Llama 3.3 70B: 14,400 req/día, 1M tokens/día
CEREBRAS_API_KEY=
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1

# Groq (RESPALDO RÁPIDO — gratuito)
# Llama 3.1 8B: 14,400 req/día | Llama 3.3 70B: 1,000 req/día
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1

# Scaleway (RESPALDO EMBEDDINGS — 1M tokens gratis)
SCALEWAY_API_KEY=
SCALEWAY_BASE_URL=https://api.scaleway.ai/v1

# ============================================================
# MODELOS ACTIVOS POR TAREA
# ============================================================
# Embeddings
EMBEDDING_PROVIDER=github_models
EMBEDDING_MODEL=text-embedding-3-small

# LLM principal (extracción, síntesis, relaciones)
LLM_PROVIDER=openrouter
LLM_MODEL_HEAVY=deepseek/deepseek-r1:free        # wiki updates, síntesis compleja
LLM_MODEL_STANDARD=meta-llama/llama-3.3-70b-instruct:free  # extracción, relaciones
LLM_MODEL_FAST=meta-llama/llama-3.2-3b-instruct:free       # tareas rápidas

# ============================================================
# WORKER
# ============================================================
REDIS_URL=
WORKER_CONCURRENCY=2

# ============================================================
# APP
# ============================================================
ADMIN_PIN=123456
ADMIN_GESTURE_SEQUENCE=tl,tr,br,bl
SIMILARITY_THRESHOLD=0.72
NEXT_PUBLIC_APP_URL=

# ============================================================
# PROCESAMIENTO
# ============================================================
MAX_PDF_SIZE_MB=50
MAX_TEXT_CHARS_FOR_EMBEDDING=8000   # Truncar si el paper es muy largo
MAX_TEXT_CHARS_FOR_EXTRACTION=6000  # Contexto para el LLM de extracción
MAX_RELATIONS_PER_PAPER=10          # Máximo de relaciones propuestas por paper
```

---

## 13. FASES DE DESARROLLO RECOMENDADAS

### Fase 1 — Fundación (MVP funcional)
- [ ] Setup Next.js + Supabase + shadcn/ui
- [ ] Schema de base de datos con pgvector (incluir `concept_nodes`, `paper_concepts`, `wiki_log`)
- [ ] Grafo básico con `react-force-graph-2d` con datos mock
- [ ] Upload de PDF y extracción de texto
- [ ] Sistema de embeddings con un provider (OpenAI)
- [ ] Pipeline completo: extracción → embedding → update wiki → relaciones
- [ ] Panel admin básico (upload + aprobar/rechazar relaciones)

### Fase 2 — Capa Wiki
- [ ] `concept_nodes`: creación y actualización por el pipeline
- [ ] `paper_concepts`: vinculación papers ↔ conceptos con relevance
- [ ] `wiki_log`: registro append-only de todas las operaciones
- [ ] Panel admin: WikiExplorer, WikiQuery, ActivityLog
- [ ] Consulta semántica a la wiki (`/api/wiki/query`)

### Fase 3 — Experiencia Visual
- [ ] Diseño visual completo (colores, tipografía, glassmorphism)
- [ ] Animación micelio para nuevas relaciones
- [ ] Nodos de `concept_nodes` visibles en el grafo (tipo diferente)
- [ ] Modal de paper con conceptos wiki linkados
- [ ] Optimización táctil (touch targets, gestos)
- [ ] Animación de carga inicial del grafo

### Fase 4 — Tiempo Real y Pulido
- [ ] Integración Supabase Realtime (nuevas relaciones en vivo)
- [ ] Worker en Railway con BullMQ
- [ ] WikiLint desde panel admin
- [ ] Bilingüismo completo ES/EN
- [ ] Gesto secreto + PIN para acceso admin
- [ ] Tests con los 10-20 papers reales

### Fase 5 — Producción
- [ ] Multi-provider AI (adaptadores Anthropic + Ollama)
- [ ] Optimización rendimiento para pantalla táctil
- [ ] Deploy final Vercel + Railway

---

## 14. PROMPTS DE IA — IMPLEMENTACIÓN DE REFERENCIA

### Extracción de conceptos (usar en `extract-concepts.ts`)
```
Sistema: Eres un analizador de papers académicos. Responde ÚNICAMENTE en JSON válido.

Usuario: Analiza este paper académico y extrae la siguiente información.
Responde SOLO con este JSON sin texto adicional:
{
  "summary_es": "Resumen de 3 oraciones claras en español",
  "summary_en": "3-sentence clear summary in English",
  "methods": ["metodología 1", "metodología 2"],
  "themes": ["tema principal 1", "tema principal 2", "tema principal 3"],
  "keywords": ["concepto clave 1", ..., "concepto clave 8"],
  "field": "área disciplinar principal"
}

Paper (texto parcial):
{FULL_TEXT_TRUNCATED_TO_6000_CHARS}
```

### Actualización de concept_node (usar en `wiki/ingest.ts`)
```
Sistema: Eres un curador de base de conocimiento académico.
Tu tarea es INTEGRAR nueva información en un resumen existente, no reemplazarlo.
Responde ÚNICAMENTE en JSON válido.

Usuario: El concepto "{CONCEPT_NAME}" ya tiene este resumen acumulado:
"{EXISTING_SUMMARY_ES}"

Un nuevo paper lo menciona con este contexto:
Título del paper: {PAPER_TITLE}
Cómo lo usa: {CONTEXT_FROM_PAPER}

Actualiza el resumen integrando esta nueva perspectiva.
Si el nuevo paper contradice algo del resumen, nótalo.
Si aporta un matiz nuevo, inclúyelo.
Mantén el resumen conciso (máximo 4 oraciones).

Responde SOLO con JSON:
{
  "summary_es": "resumen actualizado en español",
  "summary_en": "updated summary in English",
  "contradiction_noted": true/false,
  "new_dimension_added": "descripción breve del matiz nuevo, o null"
}
```

### Consulta semántica a la wiki (usar en `wiki/query.ts`)
```
Sistema: Eres un asistente de investigación académica con acceso a una base de
conocimiento estructurada de la Universidad de Caldas. Responde siempre con
citas a los papers y conceptos específicos que fundamentan tu respuesta.

Contexto de la wiki (concept_nodes relevantes):
{RELEVANT_CONCEPT_NODES_JSON}

Papers relacionados:
{RELEVANT_PAPERS_JSON}

Usuario: {QUESTION}

Responde de forma concisa y académica. Siempre cita los papers por título.
Si la respuesta requiere comparar departamentos, hazlo explícitamente.
Si no hay suficiente información en la wiki para responder, dilo claramente.
```

### Explicación de relación (usar en `find-relations.ts`)
```
Sistema: Eres un experto en análisis de redes de conocimiento académico.

Usuario: Dos papers de investigación están relacionados con una similitud de {SCORE}.

Paper A — {TITLE_A}
Conceptos wiki que comparten: {SHARED_CONCEPT_NODES}
Conceptos propios A: {CONCEPTS_A}

Paper B — {TITLE_B}  
Conceptos propios B: {CONCEPTS_B}

Genera una explicación breve (máximo 20 palabras cada una) de POR QUÉ están relacionados,
priorizando los conceptos wiki compartidos como evidencia.
Responde SOLO con JSON:
{
  "explanation_es": "Ambos investigan... / Comparten metodología de... / Convergen en...",
  "explanation_en": "Both investigate... / Share methodology of... / Converge on...",
  "relation_type": "semantic" | "methodological" | "thematic"
}
```

### Lint de la wiki (usar en `wiki/lint.ts`)
```
Sistema: Eres un auditor de bases de conocimiento académico.
Responde ÚNICAMENTE en JSON válido.

Usuario: Analiza el estado de esta wiki académica y genera un diagnóstico.

Estadísticas de la wiki:
{WIKI_STATS_JSON}

Concept nodes sin papers: {ORPHAN_CONCEPTS}
Papers sin relaciones: {ISOLATED_PAPERS}
Posibles conceptos duplicados (similitud > 0.9): {NEAR_DUPLICATE_CONCEPTS}

Genera una lista de problemas y acciones sugeridas:
{
  "issues": [
    {
      "type": "orphan_concept" | "isolated_paper" | "duplicate_concept" | "stale_summary" | "missing_concept",
      "severity": "high" | "medium" | "low",
      "description_es": "...",
      "suggested_action_es": "...",
      "entity_ids": ["id1", "id2"]
    }
  ],
  "health_score": 0-100,
  "summary_es": "La wiki tiene... puntos fuertes... y necesita..."
}
```

---

## 15. CONSIDERACIONES ESPECIALES PARA KIOSKO TÁCTIL

- **Touch targets mínimo 44×44px** en toda la interfaz
- **Evitar hover states como único indicador** — todo debe funcionar con tap
- **Texto legible a 60-80cm de distancia** — usar tamaños grandes
- **Modo sin teclado** — no requerir entrada de texto en la vista pública
- **El panel admin sí puede usar teclado virtual** nativo del sistema operativo del kiosko
- **Prevenir scroll del body** en el canvas del grafo — usar `touch-action: none`
- **Tiempo de inactividad:** Después de 120s sin interacción, el grafo vuelve a la vista general con una animación suave
- **Modo "demo automático":** En inactividad, el grafo puede rotar suavemente mostrando diferentes clusters

---

## 16. NOTAS IMPORTANTES PARA CLAUDE CODE

1. **Empezar por el grafo y la DB** — es el corazón del sistema. Todo lo demás es periférico.
2. **El worker es un proceso completamente separado** — puede deployarse como un servicio Node.js independiente en Railway, no como parte de Next.js.
3. **Los embeddings son costosos** — cachear siempre el resultado en la DB, nunca regenerar si ya existe.
4. **La animación micelio es CRÍTICA** para la experiencia — si hay trade-off entre funcionalidad admin y animación, priorizar la animación.
5. **Diseñar mobile-first verticalmente** (portrait 9:16) — el grafo debe verse bien en ese formato desde el inicio.
6. **pgvector requiere activar la extensión en Supabase** — incluir en migraciones: `CREATE EXTENSION IF NOT EXISTS vector;`
7. **Supabase Realtime requiere habilitar Replication** en las tablas `relations`, `processing_jobs` y `concept_nodes` desde el dashboard de Supabase.
8. **El sistema debe funcionar con 0 papers y escalar hasta cientos** — el grafo vacío debe tener un estado visual atractivo ("esperando investigaciones...").
9. **La wiki NO es RAG** — los `concept_nodes` son entidades persistentes con síntesis acumulada. No regenerar desde cero; siempre integrar con el summary existente usando el prompt de actualización de la Sección 14.
10. **`wiki_log` es append-only** — nunca hacer UPDATE ni DELETE en esa tabla. Solo INSERT. Es el registro histórico del sistema.
11. **Fuzzy matching para concept_nodes** — antes de crear un nuevo nodo de concepto, siempre buscar si ya existe uno similar (similitud > 0.90 en embeddings). Si existe, actualizar en lugar de duplicar. Implementar en `lib/wiki/ingest.ts`.
12. **Los concept_nodes también son nodos del grafo** — deben visualizarse diferente a los papers (forma distinta: diamante o hexágono, tamaño proporcional a `paper_count`). Son los "hubs" conceptuales que dan sentido a los clusters.
13. **Las respuestas del WikiQuery pueden guardarse** — si el admin decide guardar una respuesta como concept_node, ese nodo pasa a ser parte del grafo y puede conectarse con papers futuros.
14. **OpenRouter es el hub de IA principal** — implementar `lib/ai/router.ts` desde el inicio con la lógica de fallback. Nunca llamar a un provider específico directamente desde los jobs; siempre pasar por el router.
15. **Headers requeridos por OpenRouter** — siempre incluir `HTTP-Referer` y `X-Title` en cada request a OpenRouter, de lo contrario puede ser rechazado. Ver el adaptador en Sección 3.4.
16. **Selección de modelo por complejidad de tarea:** usar `LLM_MODEL_HEAVY` (deepseek-r1) solo para síntesis wiki y análisis de contradicciones; `LLM_MODEL_STANDARD` (llama-3.3-70b) para extracción y relaciones; `LLM_MODEL_FAST` (llama-3.2-3b) para slugs y clasificaciones simples. Esto maximiza el uso de los límites gratuitos.
17. **Embeddings en GitHub Models** — requieren `GITHUB_TOKEN` de una cuenta GitHub con acceso a GitHub Models (actualmente en beta abierto). El modelo `text-embedding-3-small` es idéntico al de OpenAI — los vectores son directamente comparables.

---

*Documento generado para el proyecto Knowledge Graph — Universidad de Caldas*
*Versión 3.0 — Mayo 2026 — Estrategia de IA 100% gratuita con OpenRouter como hub*
*Preparado para inicialización con Claude Code*
