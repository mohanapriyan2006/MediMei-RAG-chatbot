import { completeJson } from './groq'
import { getDocument } from './documentStore'
import type { ComparisonResult, ComparisonAttribute, ComparisonSummary } from '../types/comparison'
import { COMPARISON_ATTRIBUTE_KEYS, COMPARISON_ATTRIBUTE_LABELS } from '../types/comparison'

function makeCitation(documentId: string, documentName: string, index: number) {
  return {
    citationId: `${documentId}-c${index}`,
    documentId,
    documentName,
    page: 1,
  }
}

function computeSummary(attributes: ComparisonAttribute[]): ComparisonSummary {
  const totalAttributes = attributes.length
  const warningCount = attributes.filter((a) => a.drug1.status === 'warning' || a.drug2.status === 'warning').length
  const highlightCount = attributes.filter((a) => a.drug1.status === 'highlight' || a.drug2.status === 'highlight').length
  const unavailableCount = attributes.filter(
    (a) => a.drug1.status === 'unavailable' || a.drug2.status === 'unavailable',
  ).length
  const bothUnavailableCount = attributes.filter(
    (a) => a.drug1.status === 'unavailable' && a.drug2.status === 'unavailable',
  ).length
  return { totalAttributes, warningCount, highlightCount, unavailableCount, bothUnavailableCount }
}

function normalizeComparison(result: ComparisonResult, drug1Name: string, drug2Name: string): ComparisonResult {
  const attributes = (result.attributes || []).map((attr, idx) => ({
    ...attr,
    key: attr.key || `attr-${idx}`,
    label: attr.label || COMPARISON_ATTRIBUTE_LABELS[attr.key as keyof typeof COMPARISON_ATTRIBUTE_LABELS] || attr.key,
    drug1: {
      ...attr.drug1,
      citations: (attr.drug1.citations || []).map((_, i) => makeCitation(result.drug1.id, drug1Name, i)),
    },
    drug2: {
      ...attr.drug2,
      citations: (attr.drug2.citations || []).map((_, i) => makeCitation(result.drug2.id, drug2Name, i)),
    },
  }))

  return {
    drug1: { ...result.drug1, name: drug1Name },
    drug2: { ...result.drug2, name: drug2Name },
    attributes,
    summary: result.summary || computeSummary(attributes),
  }
}

export async function compareDrugs(
  drug1Id: string,
  drug2Id: string,
  signal?: AbortSignal,
): Promise<ComparisonResult> {
  if (signal?.aborted) {
    throw new DOMException('Cancelled by user', 'AbortError')
  }

  const drug1 = getDocument(drug1Id)
  const drug2 = getDocument(drug2Id)

  if (!drug1 || !drug2) {
    throw new Error('Both drugs must be selected.')
  }
  if (drug1.status !== 'ready' || drug2.status !== 'ready' || !drug1.source || !drug2.source) {
    throw new Error('Selected documents are still being processed.')
  }

  const drug1Name = drug1.name
  const drug2Name = drug2.name

  const TEXT_LIMIT = 12000
  const drug1Text = drug1.source.slice(0, TEXT_LIMIT)
  const drug2Text = drug2.source.slice(0, TEXT_LIMIT)

  const attributeList = COMPARISON_ATTRIBUTE_KEYS
    .map((key) => `${key} = ${COMPARISON_ATTRIBUTE_LABELS[key]}`)
    .join('\n')

  const systemPrompt = `You are a clinical drug comparison assistant. Compare two drug labels and return only valid JSON. Do not add markdown code fences. The drug1 and drug2 objects should include id, name, genericName, drugClass, and documentName where known. Attributes is an array with keys from the list. For each attribute, provide content for both drugs, a status ('normal', 'warning', 'highlight', or 'unavailable'), and an empty citations array if no explicit citation exists.`

  const userPrompt = `Compare these two drugs.

Attribute list (use exact keys and labels):
${attributeList}

Drug 1 (${drug1Name}):
${drug1Text}

---

Drug 2 (${drug2Name}):
${drug2Text}

Return a JSON object matching this TypeScript interface:
{
  drug1: { id: string; name: string; genericName?: string; drugClass?: string; documentName?: string; pageCount?: number };
  drug2: { id: string; name: string; genericName?: string; drugClass?: string; documentName?: string; pageCount?: number };
  attributes: Array<{ key: string; label: string; drug1: { content: string; status?: string; citations: Array<{citationId:string,documentId:string,documentName:string,page:number}> }; drug2: { content: string; status?: string; citations: Array<{citationId:string,documentId:string,documentName:string,page:number}> } }>;
  summary?: { totalAttributes: number; warningCount: number; highlightCount: number; unavailableCount: number; bothUnavailableCount: number };
}`

  const result = await completeJson<ComparisonResult>(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    signal,
  )

  return normalizeComparison(result, drug1Name, drug2Name)
}