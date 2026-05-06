import { routeLLM, routeEmbedding } from './router'
import type {
  PaperConcepts,
  WikiUpdate,
  RelationExplanation,
  PaperMeta,
  WikiQueryContext,
} from './types'

export type {
  PaperConcepts,
  WikiUpdate,
  RelationExplanation,
  PaperMeta,
  WikiQueryContext,
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return routeEmbedding(text)
}

export async function extractConcepts(text: string): Promise<PaperConcepts> {
  return routeLLM('extract_concepts', (p) => p.extractConcepts(text))
}

export async function updateWikiNode(params: {
  conceptName: string
  existingSummaryEs: string
  paperTitle: string
  paperContext: string
}): Promise<WikiUpdate> {
  return routeLLM('wiki_update', (p) => p.updateWikiNode(params))
}

export async function explainRelation(
  paperA: PaperMeta,
  paperB: PaperMeta,
  sharedConcepts: string[],
  similarityScore: number
): Promise<RelationExplanation> {
  return routeLLM('explain_relation', (p) =>
    p.explainRelation(paperA, paperB, sharedConcepts, similarityScore)
  )
}

export async function wikiQuery(
  question: string,
  context: WikiQueryContext
): Promise<string> {
  return routeLLM('wiki_query', (p) => p.wikiQuery(question, context))
}
