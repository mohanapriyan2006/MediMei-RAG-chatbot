import { MarkdownResponse } from '../common/MarkdownResponse'
import type { ComparisonResult, ComparisonCitation } from '../../types/comparison'
import { ComparisonHeader } from './ComparisonHeader'
import { ComparisonRow } from './ComparisonRow'
import { ComparisonCitationBadge } from './ComparisonCitationBadge'

interface ComparisonTableProps {
  result: ComparisonResult
  onCitationClick?: (citation: ComparisonCitation) => void
}

export function ComparisonTable({ result, onCitationClick }: ComparisonTableProps) {
  return (
    <>
      {/* Desktop / Tablet: semantic table */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-border bg-surface shadow-card animate-fade-in">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[200px]" />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <ComparisonHeader drug1={result.drug1} drug2={result.drug2} />
            </tr>
          </thead>
          <tbody>
            {result.attributes.map((attr) => (
              <ComparisonRow
                key={attr.key}
                attribute={attr}
                onCitationClick={onCitationClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked sections */}
      <div className="sm:hidden space-y-4 animate-fade-in">
        {/* Drug headers */}
        <div className="grid grid-cols-2 gap-3">
          <MobileDrugCard drug={result.drug1} />
          <MobileDrugCard drug={result.drug2} />
        </div>

        {/* Stacked attribute sections */}
        {result.attributes.map((attr) => (
          <MobileAttributeSection
            key={attr.key}
            label={attr.label}
            drug1={result.drug1}
            drug2={result.drug2}
            cell1={attr.drug1}
            cell2={attr.drug2}
            onCitationClick={onCitationClick}
          />
        ))}
      </div>
    </>
  )
}

function MobileDrugCard({ drug }: { drug: ComparisonResult['drug1'] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-subtle">
      <h3 className="text-sm font-bold text-fg truncate">{drug.name}</h3>
      {drug.genericName && <p className="text-xs text-fg-muted">{drug.genericName}</p>}
      {drug.drugClass && (
        <span className="mt-1 inline-flex items-center rounded-pill bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
          {drug.drugClass}
        </span>
      )}
    </div>
  )
}

function MobileAttributeSection({
  label,
  drug1,
  drug2,
  cell1,
  cell2,
  onCitationClick,
}: {
  label: string
  drug1: ComparisonResult['drug1']
  drug2: ComparisonResult['drug2']
  cell1: ComparisonResult['attributes'][0]['drug1']
  cell2: ComparisonResult['attributes'][0]['drug2']
  onCitationClick?: (citation: ComparisonCitation) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-subtle overflow-hidden">
      <div className="border-b border-border bg-surface-highlight/50 px-4 py-2.5">
        <h4 className="text-[13px] font-bold text-fg">{label}</h4>
      </div>
      <div className="divide-y divide-border/60">
        <MobileCell drugName={drug1.name} cell={cell1} onCitationClick={onCitationClick} />
        <MobileCell drugName={drug2.name} cell={cell2} onCitationClick={onCitationClick} />
      </div>
    </div>
  )
}

function MobileCell({
  drugName,
  cell,
  onCitationClick,
}: {
  drugName: string
  cell: ComparisonResult['attributes'][0]['drug1']
  onCitationClick?: (citation: ComparisonCitation) => void
}) {
  const isUnavailable = cell.status === 'unavailable' || (!cell.content && cell.citations.length === 0)

  return (
    <div className={`px-4 py-3 ${cell.status === 'warning' ? 'bg-warning/5' : cell.status === 'highlight' ? 'bg-primary/[0.03]' : ''}`}>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">{drugName}</p>
      {isUnavailable ? (
        <p className="italic text-fg-muted text-[13px]">Not available in source document.</p>
      ) : (
        <>
          <MarkdownResponse
            content={cell.content}
            citations={cell.citations}
            onCitationClick={(c) => onCitationClick?.(c as ComparisonCitation)}
            compact
          />
          {cell.citations.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1.5 border-t border-border/40">
              {cell.citations.map((c) => (
                <ComparisonCitationBadge
                  key={c.citationId}
                  citation={c}
                  onClick={onCitationClick}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ComparisonTable
