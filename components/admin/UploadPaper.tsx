'use client'

import { useState, useRef, useCallback } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { subscribeToProcessingJobs } from '@/lib/supabase/realtime'

const DEPARTMENTS = [
  'Artes y Humanidades',
  'Ciencias Agropecuarias',
  'Ciencias Exactas y Naturales',
  'Ciencias Jurídicas y Sociales',
  'Ciencias para la Salud',
  'Inteligencia Artificial e Ingenierías',
]

const PIPELINE_STEPS = [
  { key: 'extract-text',        label_es: 'Extrayendo texto',          label_en: 'Extracting text',         progress: 10 },
  { key: 'generate-embedding',  label_es: 'Generando embeddings',      label_en: 'Generating embeddings',    progress: 30 },
  { key: 'extract-concepts',    label_es: 'Extrayendo conceptos',      label_en: 'Extracting concepts',      progress: 50 },
  { key: 'update-wiki',         label_es: 'Actualizando wiki',         label_en: 'Updating wiki',            progress: 65 },
  { key: 'find-relations',      label_es: 'Buscando relaciones',       label_en: 'Finding relations',        progress: 80 },
  { key: 'explain-relations',   label_es: 'Explicando relaciones',     label_en: 'Explaining relations',     progress: 92 },
  { key: 'notify',              label_es: 'Finalizando',               label_en: 'Finalizing',               progress: 100 },
]

type UploadState = 'idle' | 'dragging' | 'uploading' | 'done' | 'error'

interface UploadPaperProps {
  lang: 'es' | 'en'
}

// Map a progress value 0-100 to the matching PIPELINE_STEPS index
function progressToStepIdx(p: number): number {
  for (let i = 0; i < PIPELINE_STEPS.length; i++) {
    if (p <= PIPELINE_STEPS[i].progress) return i
  }
  return PIPELINE_STEPS.length - 1
}

export default function UploadPaper({ lang }: UploadPaperProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [department, setDepartment] = useState(DEPARTMENTS[0])
  const [paperTitle, setPaperTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const realtimeUnsub = useRef<(() => void) | null>(null)

  const labels = {
    title:       lang === 'es' ? 'Subir Artículo'                  : 'Upload Paper',
    dept:        lang === 'es' ? 'Departamento'                    : 'Department',
    dropzone:    lang === 'es' ? 'Arrastra un PDF aquí'            : 'Drag a PDF here',
    dropOr:      lang === 'es' ? 'o'                               : 'or',
    browse:      lang === 'es' ? 'Seleccionar archivo'             : 'Browse file',
    uploading:   lang === 'es' ? 'Procesando artículo...'          : 'Processing paper...',
    done:        lang === 'es' ? '¡Artículo procesado con éxito!'  : 'Paper processed successfully!',
    doneDetail:  lang === 'es' ? 'El grafo se actualizará en breve con las nuevas conexiones.' : 'The graph will update shortly with new connections.',
    uploadAnother: lang === 'es' ? 'Subir otro artículo'           : 'Upload another',
    upload:      lang === 'es' ? 'Procesar artículo'               : 'Process paper',
    noFile:      lang === 'es' ? 'Selecciona un archivo PDF primero' : 'Select a PDF file first',
    onlyPdf:     lang === 'es' ? 'Solo se aceptan archivos PDF'    : 'Only PDF files are accepted',
  }

  function clearTimers() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function cleanupRealtime() {
    realtimeUnsub.current?.()
    realtimeUnsub.current = null
  }

  // Offline simulation (used when Supabase is not configured)
  const simulatePipeline = useCallback(() => {
    setState('uploading')
    setProgress(0)
    setCurrentStep(0)

    let stepIdx = 0
    function runStep() {
      if (stepIdx >= PIPELINE_STEPS.length) {
        setState('done')
        return
      }
      const step = PIPELINE_STEPS[stepIdx]
      setCurrentStep(stepIdx)
      const start = stepIdx === 0 ? 0 : PIPELINE_STEPS[stepIdx - 1].progress
      const end = step.progress
      const duration = 800 + Math.random() * 600
      const startTime = Date.now()

      function tick() {
        const elapsed = Date.now() - startTime
        const frac = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - frac, 3)
        setProgress(Math.round(start + (end - start) * eased))
        if (frac < 1) {
          timerRef.current = setTimeout(tick, 16)
        } else {
          stepIdx++
          timerRef.current = setTimeout(runStep, 200 + Math.random() * 300)
        }
      }
      tick()
    }
    runStep()
  }, [])

  // Real upload: POST to /api/papers, then track progress via Realtime
  const realUpload = useCallback(async () => {
    setState('uploading')
    setProgress(0)
    setCurrentStep(0)
    setError('')

    const fd = new FormData()
    fd.append('file', file!)
    fd.append('title', paperTitle || file!.name.replace(/\.pdf$/i, ''))
    fd.append('department', department)
    fd.append('year', String(new Date().getFullYear()))
    fd.append('authors', '[]')

    let res: Response
    try {
      res = await fetch('/api/papers', { method: 'POST', body: fd })
    } catch {
      setState('error' as UploadState)
      setError(lang === 'es' ? 'Error de red al subir el archivo' : 'Network error uploading file')
      return
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setState('error' as UploadState)
      setError(body.error ?? (lang === 'es' ? 'Error del servidor' : 'Server error'))
      return
    }

    const { id: paperId } = await res.json()

    // Subscribe to Realtime progress updates for this specific paper
    realtimeUnsub.current = subscribeToProcessingJobs(job => {
      if (job.paper_id !== paperId) return

      const p = job.progress ?? 0
      setProgress(p)
      setCurrentStep(progressToStepIdx(p))

      if (job.status === 'done') {
        cleanupRealtime()
        setState('done')
      } else if (job.status === 'error') {
        cleanupRealtime()
        setState('error' as UploadState)
        setError(job.error_message ?? (lang === 'es' ? 'Error en el procesamiento' : 'Processing error'))
      }
    })
  }, [file, paperTitle, department, lang])

  function handleFile(f: File) {
    if (!f.type.includes('pdf')) {
      setError(labels.onlyPdf)
      return
    }
    setError('')
    setFile(f)
    if (!paperTitle) setPaperTitle(f.name.replace(/\.pdf$/i, ''))
    setState('idle')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setState('idle')
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleSubmit() {
    if (!file) { setError(labels.noFile); return }
    clearTimers()
    if (isSupabaseConfigured()) {
      realUpload()
    } else {
      simulatePipeline()
    }
  }

  function reset() {
    clearTimers()
    cleanupRealtime()
    setState('idle')
    setFile(null)
    setPaperTitle('')
    setProgress(0)
    setCurrentStep(0)
    setError('')
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center gap-4 px-4">
        <div className="text-5xl animate-bounce">🎉</div>
        <h3 className="text-lg font-semibold text-green-400">{labels.done}</h3>
        <p className="text-sm text-gray-400">{labels.doneDetail}</p>
        <button
          onClick={reset}
          className="mt-4 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
        >
          {labels.uploadAnother}
        </button>
      </div>
    )
  }

  if (state === 'uploading') {
    const step = PIPELINE_STEPS[currentStep]
    const stepLabel = lang === 'es' ? step?.label_es : step?.label_en

    return (
      <div className="flex flex-col h-full">
        <h2 className="text-lg font-semibold text-white mb-6 flex-shrink-0">{labels.uploading}</h2>
        <div className="flex-1 flex flex-col justify-center gap-6 px-2">
          {/* Overall progress bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-300">{stepLabel}</span>
              <span className="text-sm font-bold text-cyan-400">{progress}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #06B6D4, #8B5CF6)',
                }}
              />
            </div>
          </div>

          {/* Step indicators */}
          <div className="space-y-2">
            {PIPELINE_STEPS.map((s, idx) => {
              const done = idx < currentStep
              const active = idx === currentStep
              const stepLbl = lang === 'es' ? s.label_es : s.label_en
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs transition-colors ${
                    done   ? 'bg-green-500 text-white' :
                    active ? 'bg-cyan-500 text-white' :
                             'bg-white/10 text-gray-600'
                  }`}>
                    {done ? '✓' : idx + 1}
                  </div>
                  <span className={`text-sm transition-colors ${
                    done   ? 'text-green-400' :
                    active ? 'text-cyan-300 font-medium' :
                             'text-gray-600'
                  }`}>
                    {stepLbl}
                  </span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping ml-auto" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-white mb-4 flex-shrink-0">{labels.title}</h2>

      {/* Paper title */}
      <div className="mb-3 flex-shrink-0">
        <label className="text-xs text-gray-400 mb-1.5 block font-medium">
          {lang === 'es' ? 'Título del artículo' : 'Paper title'}
        </label>
        <input
          type="text"
          value={paperTitle}
          onChange={e => setPaperTitle(e.target.value)}
          placeholder={lang === 'es' ? 'Título (se detecta del PDF si se deja vacío)' : 'Title (auto-detected if blank)'}
          className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60"
        />
      </div>

      {/* Department selector */}
      <div className="mb-3 flex-shrink-0">
        <label className="text-xs text-gray-400 mb-1.5 block font-medium">{labels.dept}</label>
        <select
          value={department}
          onChange={e => setDepartment(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500/60 appearance-none cursor-pointer"
        >
          {DEPARTMENTS.map(d => (
            <option key={d} value={d} className="bg-gray-900 text-white">{d}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors cursor-pointer min-h-0 ${
          state === 'dragging'
            ? 'border-cyan-400 bg-cyan-400/10'
            : file
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/8'
        }`}
        onDragOver={e => { e.preventDefault(); setState('dragging') }}
        onDragLeave={() => setState('idle')}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {file ? (
          <div className="text-center px-4">
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm text-green-400 font-medium">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <div className="text-center px-4">
            <div className="text-3xl mb-3">{state === 'dragging' ? '📥' : '📂'}</div>
            <p className="text-sm text-gray-400">{labels.dropzone}</p>
            <p className="text-xs text-gray-600 my-2">{labels.dropOr}</p>
            <span className="text-xs text-cyan-400 underline">{labels.browse}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-2 flex-shrink-0">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file}
        className="mt-4 w-full py-3 rounded-xl text-sm font-semibold transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: file ? 'linear-gradient(135deg, #06B6D4, #8B5CF6)' : undefined,
          backgroundColor: file ? undefined : 'rgba(255,255,255,0.1)',
          color: 'white',
        }}
      >
        {labels.upload}
      </button>
    </div>
  )
}
