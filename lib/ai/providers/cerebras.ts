import { createLLMProvider } from './openrouter'

// Cerebras: hardware especializado para inferencia, Llama 3.3 70B
// Límites: 14 400 req/día, 1M tokens/día (plan gratuito)
export const cerebras = createLLMProvider({
  baseURL: process.env.CEREBRAS_BASE_URL ?? 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY ?? '',
  models: {
    heavy:    'llama-3.3-70b',
    standard: 'llama-3.3-70b',
    fast:     'llama-3.1-8b',
  },
})
