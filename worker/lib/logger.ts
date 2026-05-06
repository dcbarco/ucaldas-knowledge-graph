// Logger con formato timestamp + paperId — igual en todos los jobs
export function log(paperId: string, message: string, data?: Record<string, unknown>): void {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [paper:${paperId}]`
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data))
  } else {
    console.log(`${prefix} ${message}`)
  }
}

export function logError(paperId: string, message: string, error: unknown): void {
  const ts = new Date().toISOString()
  const err = error instanceof Error ? error.message : String(error)
  console.error(`[${ts}] [paper:${paperId}] ❌ ${message}: ${err}`)
}

// Mock de llamada a Supabase para actualizar processing_jobs
export function mockDB(paperId: string, query: string): void {
  console.log(`  [DB-MOCK] [paper:${paperId}] ${query}`)
}
