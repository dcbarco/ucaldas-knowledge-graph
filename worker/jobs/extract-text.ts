// Paso 1 — Extracción de texto del PDF                       [10%]
// Producción: descarga el PDF desde Supabase Storage y usa pdf-parse
// para obtener el texto completo → papers.full_text

import { log, logError, mockDB } from '../lib/logger'
import type { ProgressUpdater } from '../lib/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function extractText(
  paperId: string,
  pdfPath: string,
  update: ProgressUpdater
): Promise<string> {
  await update(5, 'Descargando PDF desde Storage')
  log(paperId, `Descargando PDF: ${pdfPath}`)

  // PRODUCCIÓN:
  // const { data, error } = await supabase.storage.from('papers').download(pdfPath)
  // if (error) throw new Error(`Storage download failed: ${error.message}`)
  // const buffer = Buffer.from(await data.arrayBuffer())
  mockDB(paperId, `storage.from('papers').download('${pdfPath}')`)
  await delay(400) // simula latencia de red

  await update(8, 'Parseando PDF con pdf-parse')
  log(paperId, 'Extrayendo texto con pdf-parse')

  // PRODUCCIÓN:
  // const parsed = await pdfParse(buffer)
  // const fullText = parsed.text.trim()
  // if (!fullText || fullText.length < 100) throw new Error('PDF sin texto extraíble (posible imagen)')
  mockDB(paperId, `pdfParse(buffer) → ${Math.floor(Math.random() * 8000 + 2000)} chars`)
  await delay(600)

  await update(10, 'Texto extraído — actualizando papers')
  const mockFullText = [
    `[MOCK] Texto extraído del paper ${paperId}`,
    `PDF path: ${pdfPath}`,
    'Este paper analiza metodologías interdisciplinares aplicadas a comunidades rurales',
    'del departamento de Caldas. Se emplean técnicas de análisis de redes sociales',
    'combinadas con etnografía digital para comprender las dinámicas comunitarias.',
    'Los resultados muestran correlaciones significativas entre densidad de red',
    'y resiliencia comunitaria ante eventos climáticos extremos.',
  ].join('\n')

  // PRODUCCIÓN:
  // await supabase.from('papers').update({ full_text: fullText, status: 'processing' }).eq('id', paperId)
  mockDB(paperId, `papers.update({ full_text: '${mockFullText.slice(0, 40)}...', status: 'processing' }).eq('id', '${paperId}')`)

  log(paperId, `Texto extraído: ${mockFullText.length} caracteres`)
  return mockFullText
}
