'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import UploadPaper from './UploadPaper'
import RelationReview from './RelationReview'
import WikiExplorer from './WikiExplorer'
import ActivityLog from './ActivityLog'
import ManagePapers from './ManagePapers'
import type { KnowledgeGraphHandle } from '@/components/graph/KnowledgeGraph'

// Corner tap sequence: top-left → top-right → bottom-right → bottom-left
const CORNER_SEQUENCE = ['tl', 'tr', 'br', 'bl'] as const
type Corner = typeof CORNER_SEQUENCE[number]
const SEQUENCE_TIMEOUT_MS = 5_000
const CORRECT_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '123456'

type Tab = 'upload' | 'relations' | 'wiki' | 'activity' | 'manage'

interface Tab_ {
  id: Tab
  icon: string
  label_es: string
  label_en: string
}

const TABS: Tab_[] = [
  { id: 'upload',    icon: '📤', label_es: 'Subir',       label_en: 'Upload' },
  { id: 'manage',    icon: '🗑',  label_es: 'Gestión',     label_en: 'Manage' },
  { id: 'relations', icon: '🔗', label_es: 'Relaciones',  label_en: 'Relations' },
  { id: 'wiki',      icon: '🧠', label_es: 'Wiki',        label_en: 'Wiki' },
  { id: 'activity',  icon: '📋', label_es: 'Actividad',   label_en: 'Activity' },
]

interface AdminDrawerProps {
  lang: 'es' | 'en'
  graphHandle: React.MutableRefObject<KnowledgeGraphHandle | null>
}

export default function AdminDrawer({ lang, graphHandle }: AdminDrawerProps) {
  const [phase, setPhase] = useState<'hidden' | 'pin' | 'open'>('hidden')
  const [activeTab, setActiveTab] = useState<Tab>('upload')

  // Corner tap state
  const sequenceRef = useRef<Corner[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // PIN state
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [shake, setShake] = useState(false)

  function resetSequence() {
    sequenceRef.current = []
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  const handleCornerTap = useCallback((corner: Corner) => {
    const seq = sequenceRef.current
    const expected = CORNER_SEQUENCE[seq.length]

    if (corner !== expected) {
      resetSequence()
      return
    }

    seq.push(corner)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(resetSequence, SEQUENCE_TIMEOUT_MS)

    if (seq.length === CORNER_SEQUENCE.length) {
      resetSequence()
      setPhase('pin')
      setPin('')
      setPinError(false)
    }
  }, [])

  // Keyboard shortcut: Ctrl+Shift+A → skip gesture, go straight to PIN
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        setPhase('pin')
        setPin('')
        setPinError(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // PIN digit entry
  useEffect(() => {
    if (phase !== 'pin') return
    if (pin.length < 6) return

    if (pin === CORRECT_PIN) {
      setPhase('open')
      setPin('')
    } else {
      setPinError(true)
      setShake(true)
      setTimeout(() => {
        setShake(false)
        setPinError(false)
        setPin('')
      }, 600)
    }
  }, [pin, phase])

  function handlePinKey(digit: string) {
    if (pin.length >= 6) return
    setPin(prev => prev + digit)
  }

  function handlePinDelete() {
    setPin(prev => prev.slice(0, -1))
  }

  function closeDrawer() {
    setPhase('hidden')
    setPin('')
    setPinError(false)
  }

  const pinLabels = {
    title:  lang === 'es' ? 'Código de acceso' : 'Access code',
    cancel: lang === 'es' ? 'Cancelar'         : 'Cancel',
    error:  lang === 'es' ? 'PIN incorrecto'   : 'Incorrect PIN',
  }

  return (
    <>
      {/* Invisible corner tap targets */}
      {(['tl', 'tr', 'br', 'bl'] as Corner[]).map(corner => (
        <div
          key={corner}
          className="fixed z-50 w-20 h-20"
          style={{
            top:    corner.startsWith('t') ? 0 : undefined,
            bottom: corner.startsWith('b') ? 0 : undefined,
            left:   corner.endsWith('l')   ? 0 : undefined,
            right:  corner.endsWith('r')   ? 0 : undefined,
            cursor: 'default',
          }}
          onPointerDown={(e) => { e.stopPropagation(); handleCornerTap(corner) }}
        />
      ))}

      {/* PIN modal */}
      <AnimatePresence>
        {phase === 'pin' && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => { setPhase('hidden'); setPin('') }}
            />

            {/* PIN card */}
            <motion.div
              className="relative z-10 w-72 rounded-3xl bg-[#0a1020] border border-white/10 p-6 shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0, x: shake ? [-8, 8, -8, 8, 0] : 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
            >
              <h3 className="text-center text-white font-semibold mb-5">{pinLabels.title}</h3>

              {/* Dots */}
              <div className="flex justify-center gap-3 mb-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      i < pin.length
                        ? pinError ? 'bg-red-500' : 'bg-cyan-400'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-center text-red-400 text-xs mb-4">{pinLabels.error}</p>
              )}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((digit, i) => {
                  if (digit === '') return <div key={`empty-${i}`} />
                  return (
                    <button
                      key={`digit-${digit}-${i}`}
                      onClick={() => digit === '⌫' ? handlePinDelete() : handlePinKey(digit)}
                      className="h-12 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-lg font-medium transition-all"
                    >
                      {digit}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => { setPhase('hidden'); setPin('') }}
                className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-400 transition-colors"
              >
                {pinLabels.cancel}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {phase === 'open' && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
            />

            {/* Drawer panel */}
            <motion.div
              className="fixed right-0 top-0 bottom-0 z-50 w-[85vw] max-w-sm flex flex-col"
              style={{
                background: 'linear-gradient(180deg, #080f1e 0%, #040810 100%)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚙️</span>
                  <span className="text-white font-semibold text-sm">
                    {lang === 'es' ? 'Panel de Administración' : 'Admin Panel'}
                  </span>
                </div>
                <button
                  onClick={closeDrawer}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-white/8 flex-shrink-0">
                {TABS.map(tab => {
                  const label = lang === 'es' ? tab.label_es : tab.label_en
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
                        active ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-gray-400'
                      }`}
                    >
                      <span className="text-base">{tab.icon}</span>
                      <span className="text-[10px] font-medium">{label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    className="h-full"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {activeTab === 'upload'    && <UploadPaper    lang={lang} />}
                    {activeTab === 'manage'    && <ManagePapers   lang={lang} />}
                    {activeTab === 'relations' && <RelationReview lang={lang} graphHandle={graphHandle} />}
                    {activeTab === 'wiki'      && <WikiExplorer   lang={lang} />}
                    {activeTab === 'activity'  && <ActivityLog    lang={lang} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
