import type { OfficialDataBundle } from './officialDataBundle.js';

export type OfficialDataValidationSummary = {
  schemaVersion: 1;
  importedAt: string;
  sourceUpdatedAt: string | null;
  sourceRows: number;
  acceptedRows: number;
  rejectedRows: number;
  ambiguousRows: number;
  coveredRegions: number;
  rules: number;
  criticalErrors: string[];
  warnings: string[];
};

function latestSourceUpdatedAt(bundle: OfficialDataBundle): string | null {
  const dates = bundle.rules
    .map((rule) => rule.provenance.sourceUpdatedAt)
    .filter((value): value is string => Boolean(value))
    .sort();

  return dates[dates.length - 1] ?? null;
}

export function buildOfficialDataValidationSummary(
  bundle: OfficialDataBundle,
): OfficialDataValidationSummary {
  const criticalErrors: string[] = [];
  const warnings: string[] = [];

  if (bundle.regions.length === 0) {
    criticalErrors.push('No selectable regions were produced.');
  }
  if (bundle.rules.length === 0) {
    criticalErrors.push('No collection rules were produced.');
  }

  if (bundle.reports.source.rejectedRows > 0) {
    warnings.push(`${bundle.reports.source.rejectedRows} source row(s) were rejected.`);
  }
  if (bundle.reports.mapping.unresolvedRows > 0) {
    warnings.push(`${bundle.reports.mapping.unresolvedRows} target area row(s) were unresolved.`);
  }
  if (bundle.reports.mapping.ambiguousTargetAreas > 0) {
    warnings.push(`${bundle.reports.mapping.ambiguousTargetAreas} target area(s) were ambiguous.`);
  }
  if (bundle.reports.normalization.ambiguousRows > 0) {
    warnings.push(`${bundle.reports.normalization.ambiguousRows} normalized source row(s) are ambiguous.`);
  }
  if (bundle.reports.normalization.errors.length > 0) {
    warnings.push(`${bundle.reports.normalization.errors.length} normalization error(s) were recorded.`);
  }
  if (bundle.reports.adapter.skippedSourceRows > 0) {
    warnings.push(`${bundle.reports.adapter.skippedSourceRows} source row(s) were skipped by the rule adapter.`);
  }

  return {
    schemaVersion: 1,
    importedAt: bundle.importedAt,
    sourceUpdatedAt: latestSourceUpdatedAt(bundle),
    sourceRows: bundle.reports.source.totalRows,
    acceptedRows: bundle.reports.source.acceptedRows,
    rejectedRows: bundle.reports.source.rejectedRows,
    ambiguousRows: bundle.reports.normalization.ambiguousRows,
    coveredRegions: bundle.regions.length,
    rules: bundle.rules.length,
    criticalErrors,
    warnings,
  };
}

export function serializeOfficialDataValidationSummary(
  summary: OfficialDataValidationSummary,
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
