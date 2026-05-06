import { createLLMProvider } from './openrouter'

// Groq: inferencia ultra-rápida, óptimo para quick_classify
// Límites: llama-3.1-8b 14 400 req/día | llama-3.3-70b 1 000 req/día
export const groq = createLLMProvider({
  baseURL: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY ?? '',
  models: {
    heavy:    'llama-3.3-70b-versatile',
    standard: 'llama-3.3-70b-versatile',
    fast:     'llama-3.1-8b-instant',
  },
})
