import type { OfficialDataBundle } from './officialDataBundle.js';
import {
  buildOfficialDataValidationSummary,
  type OfficialDataValidationSummary,
} from './officialDataValidationSummary.js';

export type ProductionDataVerificationResult = {
  importedAt: string;
  sourceUpdatedAt: string | null;
  coveredRegions: number;
  rules: number;
  warnings: number;
};

function mismatch(message: string): never {
  throw new Error(`Production data verification failed: ${message}`);
}

export function verifyProductionDataPair(
  bundle: OfficialDataBundle,
  report: OfficialDataValidationSummary,
): ProductionDataVerificationResult {
  if (report.schemaVersion !== 1) {
    mismatch(`unsupported validation schemaVersion ${String(report.schemaVersion)}`);
  }

  if (report.criticalErrors.length > 0) {
    mismatch(`validation contains critical error(s): ${report.criticalErrors.join(' ')}`);
  }

  const expected = buildOfficialDataValidationSummary(bundle);

  if (report.importedAt !== bundle.importedAt) {
    mismatch('validation importedAt does not match deployable asset');
  }
  if (report.sourceRows !== expected.sourceRows) {
    mismatch('source row count does not match deployable asset');
  }
  if (report.acceptedRows !== expected.acceptedRows) {
    mismatch('accepted row count does not match deployable asset');
  }
  if (report.rejectedRows !== expected.rejectedRows) {
    mismatch('rejected row count does not match deployable asset');
  }
  if (report.ambiguousRows !== expected.ambiguousRows) {
    mismatch('ambiguous row count does not match deployable asset');
  }
  if (report.coveredRegions !== expected.coveredRegions) {
    mismatch('covered region count does not match deployable asset');
  }
  if (report.rules !== expected.rules) {
    mismatch('rule count does not match deployable asset');
  }
  if (report.sourceUpdatedAt !== expected.sourceUpdatedAt) {
    mismatch('sourceUpdatedAt does not match deployable asset');
  }
  if (JSON.stringify(report.warnings) !== JSON.stringify(expected.warnings)) {
    mismatch('validation warnings do not match deployable asset');
  }

  return {
    importedAt: bundle.importedAt,
    sourceUpdatedAt: report.sourceUpdatedAt,
    coveredRegions: bundle.regions.length,
    rules: bundle.rules.length,
    warnings: report.warnings.length,
  };
}
