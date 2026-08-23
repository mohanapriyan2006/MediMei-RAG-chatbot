import type { Citation } from './chat'

export type ComparisonCellStatus = 'normal' | 'warning' | 'highlight' | 'unavailable'

export type ComparisonCitation = Citation

export interface ComparisonCell {
  content: string
  citations: ComparisonCitation[]
  status?: ComparisonCellStatus
}

export interface ComparisonAttribute {
  key: string
  label: string
  drug1: ComparisonCell
  drug2: ComparisonCell
}

export interface DrugInfo {
  id: string
  name: string
  genericName?: string
  drugClass?: string
  documentName?: string
  pageCount?: number
}

export interface ComparisonSummary {
  totalAttributes: number
  warningCount: number
  highlightCount: number
  unavailableCount: number
  bothUnavailableCount: number
}

export interface ComparisonResult {
  drug1: DrugInfo
  drug2: DrugInfo
  attributes: ComparisonAttribute[]
  summary?: ComparisonSummary
}

export interface SavedComparison {
  id: string
  title: string
  drug1Id: string
  drug2Id: string
  drug1Name: string
  drug2Name: string
  savedAt: string
  notes?: string
  result: ComparisonResult
}

export const COMPARISON_ATTRIBUTE_KEYS = [
  'indications',
  'dosage_administration',
  'warnings',
  'contraindications',
  'drug_interactions',
  'adverse_reactions',
  'use_in_specific_populations',
  'pregnancy',
  'pediatric_use',
  'geriatric_use',
  'renal_impairment',
  'hepatic_impairment',
  'storage',
] as const

export type ComparisonAttributeKey = (typeof COMPARISON_ATTRIBUTE_KEYS)[number]

export const COMPARISON_ATTRIBUTE_LABELS: Record<ComparisonAttributeKey, string> = {
  indications: 'Indications',
  dosage_administration: 'Dosage & Administration',
  warnings: 'Warnings',
  contraindications: 'Contraindications',
  drug_interactions: 'Drug Interactions',
  adverse_reactions: 'Adverse Reactions',
  use_in_specific_populations: 'Use in Specific Populations',
  pregnancy: 'Pregnancy',
  pediatric_use: 'Pediatric Use',
  geriatric_use: 'Geriatric Use',
  renal_impairment: 'Renal Impairment',
  hepatic_impairment: 'Hepatic Impairment',
  storage: 'Storage',
}
