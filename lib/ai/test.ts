// Test manual de la capa AI.
// Ejecutar con: npx ts-node --project tsconfig.json lib/ai/test.ts
// Requiere OPENROUTER_API_KEY en .env.local

import { extractConcepts } from './index'

const SAMPLE_TEXT = `
Análisis de Redes Sociales en Comunidades Rurales de Caldas: Un Enfoque Metodológico Mixto

Este estudio examina las estructuras de red social en tres comunidades rurales del
departamento de Caldas, Colombia, utilizando métodos cuantitativos y cualitativos.
Mediante análisis de grafos aplicamos el algoritmo de Louvain para detectar comunidades
y entrevistas semi-estructuradas para contextualizar los hallazgos.

Los resultados revelan que las comunidades con mayor densidad de red presentan mejores
indicadores de resiliencia ante desastres naturales. Se identificaron nodos puente clave
que conectan diferentes grupos sociales y facilitan la difusión de información.

La metodología mixta permitió capturar tanto la estructura formal de las redes como
los significados culturales que los actores asignan a sus vínculos sociales. Este trabajo
contribuye a la comprensión de cómo el capital social estructural incide en la capacidad
adaptativa de comunidades vulnerables en contextos rurales colombianos.
`.trim()

async function main() {
  console.log('=== Test: extractConcepts ===\n')
  console.log(`Texto de entrada (${SAMPLE_TEXT.length} chars):`)
  console.log(SAMPLE_TEXT.slice(0, 120) + '...\n')

  const result = await extractConcepts(SAMPLE_TEXT)

  console.log('Resultado:')
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
