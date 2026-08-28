import type { OfficialDataBundle } from './officialDataBundle.js';

type ErrorCodeEntry = { code: string };

function countErrorCodes(items: readonly ErrorCodeEntry[]): Record<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.code, (counts.get(item.code) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, 'en')),
  );
}

export type OfficialDataFailureDiagnostics = {
  sourceRows: number;
  acceptedSourceRows: number;
  rejectedSourceRows: number;
  selectableRegions: number;
  unresolvedTargetAreaRows: number;
  ambiguousTargetAreas: number;
  adapterSourceRows: number;
  adapterExpandedRows: number;
  adapterSkippedSourceRows: number;
  adapterErrorCodes: Record<string, number>;
  normalizationRows: number;
  normalizationAcceptedRows: number;
  normalizationRejectedRows: number;
  normalizationErrorCodes: Record<string, number>;
  producedRules: number;
};

export function buildOfficialDataFailureDiagnostics(
  bundle: OfficialDataBundle,
): OfficialDataFailureDiagnostics {
  return {
    sourceRows: bundle.reports.source.totalRows,
    acceptedSourceRows: bundle.reports.source.acceptedRows,
    rejectedSourceRows: bundle.reports.source.rejectedRows,
    selectableRegions: bundle.reports.mapping.selectableRegions,
    unresolvedTargetAreaRows: bundle.reports.mapping.unresolvedRows,
    ambiguousTargetAreas: bundle.reports.mapping.ambiguousTargetAreas,
    adapterSourceRows: bundle.reports.adapter.sourceRows,
    adapterExpandedRows: bundle.reports.adapter.expandedRows,
    adapterSkippedSourceRows: bundle.reports.adapter.skippedSourceRows,
    adapterErrorCodes: countErrorCodes(bundle.reports.adapter.errors),
    normalizationRows: bundle.reports.normalization.totalRows,
    normalizationAcceptedRows: bundle.reports.normalization.acceptedRows,
    normalizationRejectedRows: bundle.reports.normalization.rejectedRows,
    normalizationErrorCodes: countErrorCodes(bundle.reports.normalization.errors),
    producedRules: bundle.rules.length,
  };
}
