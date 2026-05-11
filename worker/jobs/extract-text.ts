// Paso 1 — Extracción de texto del PDF  [10%]
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
import { supabase } from '../lib/supabase'
import { log } from '../lib/logger'
import type { ProgressUpdater } from '../lib/types'

export async function extractText(
  paperId: string,
  pdfPath: string,
  update: ProgressUpdater
): Promise<string> {
  await update(5, 'Descargando PDF desde Storage')
  log(paperId, `Descargando: ${pdfPath}`)

  const { data, error } = await supabase.storage.from('papers').download(pdfPath)
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`)

  await update(8, 'Parseando PDF con pdf-parse')
  const buffer = Buffer.from(await data.arrayBuffer())
  const parsed = await pdfParse(buffer)
  const fullText = parsed.text.trim()

  if (!fullText || fullText.length < 50) {
    throw new Error('PDF sin texto extraíble (posible imagen o PDF escaneado)')
  }

  await update(10, 'Texto extraído — guardando en base de datos')
  await supabase.from('papers').update({ full_text: fullText }).eq('id', paperId)

  log(paperId, `Texto extraído: ${fullText.length} caracteres`)
  return fullText
}
