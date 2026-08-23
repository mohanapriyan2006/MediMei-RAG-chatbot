import { compareDrugsApi } from '../api/compare'
import type { ComparisonResult } from '../types/comparison'

/**
 * Service abstraction for drug comparison.
 *
 * If the backend comparison endpoint is available, the real API is used.
 * Otherwise a clearly-isolated mock is returned so the UI is fully functional
 * during development. The mock must NEVER be used in production — it is gated
 * behind an explicit feature flag.
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK_COMPARE === 'true'

export async function compareDrugs(
  drug1Id: string,
  drug2Id: string,
  signal?: AbortSignal,
): Promise<ComparisonResult> {
  if (signal?.aborted) {
    throw new DOMException('Cancelled by user', 'AbortError')
  }
  if (USE_MOCK) {
    return mockCompareDrugs(drug1Id, drug2Id, signal)
  }
  return compareDrugsApi(drug1Id, drug2Id, signal)
}

/* ------------------------------------------------------------------ */
/* MOCK — isolated, clearly marked, development-only                   */
/* ------------------------------------------------------------------ */

function mockCompareDrugs(drug1Id: string, drug2Id: string, signal?: AbortSignal): Promise<ComparisonResult> {
  const result: ComparisonResult = {
    drug1: {
      id: drug1Id,
      name: 'Rinvoq',
      genericName: 'upadacitinib',
      drugClass: 'JAK inhibitor',
      documentName: 'Rinvoq Prescribing Information',
      pageCount: 48,
    },
    drug2: {
      id: drug2Id,
      name: 'Skyrizi',
      genericName: 'risankizumab-rzaa',
      drugClass: 'IL-23 inhibitor',
      documentName: 'Skyrizi Prescribing Information',
      pageCount: 32,
    },
    attributes: [
      {
        key: 'indications',
        label: 'Indications',
        drug1: {
          content:
            'Rheumatoid arthritis, psoriatic arthritis, axial spondyloarthritis, atopic dermatitis, ulcerative colitis, and Crohn\u2019s disease.',
          citations: [
            { citationId: 'mock-1', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 12, section: 'Indications' },
            { citationId: 'mock-2', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 18, section: 'Indications' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'Moderate-to-severe plaque psoriasis, psoriatic arthritis, and Crohn\u2019s disease.',
          citations: [
            { citationId: 'mock-3', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 7, section: 'Indications' },
          ],
          status: 'normal',
        },
      },
      {
        key: 'dosage_administration',
        label: 'Dosage & Administration',
        drug1: {
          content: '15 mg once daily. May increase to 30 mg once daily if indicated.',
          citations: [
            { citationId: 'mock-4', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 8, section: 'Dosage' },
          ],
          status: 'highlight',
        },
        drug2: {
          content: '150 mg subcutaneous injection at Week 0, Week 4, and every 12 weeks thereafter.',
          citations: [
            { citationId: 'mock-5', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 5, section: 'Dosage' },
          ],
          status: 'highlight',
        },
      },
      {
        key: 'warnings',
        label: 'Warnings',
        drug1: {
          content:
            'Serious infections, malignancies, major adverse cardiovascular events, and thrombosis.',
          citations: [
            { citationId: 'mock-6', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 13, section: 'Warnings' },
          ],
          status: 'warning',
        },
        drug2: {
          content: 'Infections and hypersensitivity reactions.',
          citations: [
            { citationId: 'mock-7', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 9, section: 'Warnings' },
          ],
          status: 'warning',
        },
      },
      {
        key: 'contraindications',
        label: 'Contraindications',
        drug1: {
          content: 'Hypersensitivity to upadacitinib or any excipients. Active serious infection.',
          citations: [
            { citationId: 'mock-8', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 14, section: 'Contraindications' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'Hypersensitivity to risankizumab-rzaa or any excipients.',
          citations: [
            { citationId: 'mock-9', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 10, section: 'Contraindications' },
          ],
          status: 'normal',
        },
      },
      {
        key: 'drug_interactions',
        label: 'Drug Interactions',
        drug1: {
          content: 'Avoid use with strong CYP3A inhibitors. Live vaccines should not be given concurrently.',
          citations: [
            { citationId: 'mock-10', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 20, section: 'Interactions' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'No clinically significant drug interactions identified.',
          citations: [
            { citationId: 'mock-11', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 11, section: 'Interactions' },
          ],
          status: 'normal',
        },
      },
      {
        key: 'adverse_reactions',
        label: 'Adverse Reactions',
        drug1: {
          content: 'Upper respiratory tract infections, nausea, headache, and acne.',
          citations: [
            { citationId: 'mock-12', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 22, section: 'Adverse Reactions' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'Upper respiratory tract infections, headache, fatigue, and injection site reactions.',
          citations: [
            { citationId: 'mock-13', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 12, section: 'Adverse Reactions' },
          ],
          status: 'normal',
        },
      },
      {
        key: 'use_in_specific_populations',
        label: 'Use in Specific Populations',
        drug1: {
          content: 'Use in pregnancy, lactation, pediatric, geriatric, renal and hepatic impairment populations described below.',
          citations: [
            { citationId: 'mock-14', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 28, section: 'Specific Populations' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'Limited data in specific populations. See individual sections below.',
          citations: [
            { citationId: 'mock-15', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 14, section: 'Specific Populations' },
          ],
          status: 'normal',
        },
      },
      {
        key: 'pregnancy',
        label: 'Pregnancy',
        drug1: {
          content: 'Based on animal data, may cause fetal harm. Advise pregnant women of potential risk.',
          citations: [
            { citationId: 'mock-16', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 30, section: 'Pregnancy' },
          ],
          status: 'warning',
        },
        drug2: {
          content: 'No human data on use in pregnancy. Animal reproduction studies have not been conducted.',
          citations: [
            { citationId: 'mock-17', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 15, section: 'Pregnancy' },
          ],
          status: 'normal',
        },
      },
      {
        key: 'pediatric_use',
        label: 'Pediatric Use',
        drug1: {
          content: 'Safety and effectiveness in pediatric patients with atopic dermatitis (ages 12+). Not established for other indications.',
          citations: [
            { citationId: 'mock-18', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 32, section: 'Pediatric Use' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'Not available in source document.',
          citations: [],
          status: 'unavailable',
        },
      },
      {
        key: 'geriatric_use',
        label: 'Geriatric Use',
        drug1: {
          content: 'No overall differences in safety or effectiveness observed between elderly and younger patients.',
          citations: [
            { citationId: 'mock-19', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 34, section: 'Geriatric Use' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'No dose adjustment required for elderly patients.',
          citations: [
            { citationId: 'mock-20', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 16, section: 'Geriatric Use' },
          ],
          status: 'normal',
        },
      },
      {
        key: 'renal_impairment',
        label: 'Renal Impairment',
        drug1: {
          content: 'No dose adjustment needed for mild or moderate renal impairment. Not recommended in severe renal impairment.',
          citations: [
            { citationId: 'mock-21', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 36, section: 'Renal Impairment' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'Not available in source document.',
          citations: [],
          status: 'unavailable',
        },
      },
      {
        key: 'hepatic_impairment',
        label: 'Hepatic Impairment',
        drug1: {
          content: 'Not recommended in severe hepatic impairment. No adjustment for mild/moderate.',
          citations: [
            { citationId: 'mock-22', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 38, section: 'Hepatic Impairment' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'Not available in source document.',
          citations: [],
          status: 'unavailable',
        },
      },
      {
        key: 'storage',
        label: 'Storage',
        drug1: {
          content: 'Store at 20\u201325\u00b0C (68\u201377\u00b0F). Excursions permitted between 15\u201330\u00b0C.',
          citations: [
            { citationId: 'mock-23', documentId: drug1Id, documentName: 'Rinvoq Prescribing Information', page: 44, section: 'Storage' },
          ],
          status: 'normal',
        },
        drug2: {
          content: 'Refrigerate at 2\u20138\u00b0C (36\u201346\u00b0F). Do not freeze. Protect from light.',
          citations: [
            { citationId: 'mock-24', documentId: drug2Id, documentName: 'Skyrizi Prescribing Information', page: 30, section: 'Storage' },
          ],
          status: 'normal',
        },
      },
    ],
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Cancelled by user', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      if (signal?.aborted) {
        reject(new DOMException('Cancelled by user', 'AbortError'))
      } else {
        resolve(result)
      }
    }, 1200)
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new DOMException('Cancelled by user', 'AbortError'))
      })
    }
  })
}
