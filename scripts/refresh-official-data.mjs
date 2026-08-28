import { buildOfficialDataBundleFromRows } from '../dist-tests/src/data/canonical/officialDataBundle.js';
import { serializeOfficialDataAsset } from '../dist-tests/src/data/canonical/officialDataAsset.js';
import { buildOfficialDataFailureDiagnostics } from '../dist-tests/src/data/canonical/officialDataFailureDiagnostics.js';
import {
  buildOfficialDataValidationSummary,
  serializeOfficialDataValidationSummary,
} from '../dist-tests/src/data/canonical/officialDataValidationSummary.js';
import { fetchOfficialHouseholdWasteApiRows } from '../dist-tests/src/data/import/householdWasteApi.js';
import { writeOfficialDataOutputs } from './official-data-outputs.mjs';

const USAGE = 'Usage: node scripts/refresh-official-data.mjs --output <json> --report-output <json> --imported-at <timestamp>';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--output') options.output = value;
    if (flag === '--report-output') options.reportOutput = value;
    if (flag === '--imported-at') options.importedAt = value;

    if (flag === '--output' || flag === '--report-output' || flag === '--imported-at') {
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const serviceKey = process.env.DATA_GO_KR_API_KEY?.trim();

if (!options.output || !options.reportOutput || !options.importedAt) {
  console.error(USAGE);
  process.exitCode = 1;
} else if (!serviceKey) {
  console.error('DATA_GO_KR_API_KEY is required');
  process.exitCode = 1;
} else {
  try {
    const collection = await fetchOfficialHouseholdWasteApiRows({ serviceKey });
    const bundle = buildOfficialDataBundleFromRows(
      collection.rows,
      collection.sourceReport,
      options.importedAt,
    );
    const summary = buildOfficialDataValidationSummary(bundle);

    if (summary.criticalErrors.length > 0) {
      console.error(`Official data validation diagnostics: ${JSON.stringify(buildOfficialDataFailureDiagnostics(bundle))}`);
      throw new Error(`Official data validation failed: ${summary.criticalErrors.join(' ')}`);
    }

    const asset = serializeOfficialDataAsset(bundle);
    const report = serializeOfficialDataValidationSummary(summary);

    await writeOfficialDataOutputs({
      assetOutput: options.output,
      reportOutput: options.reportOutput,
      asset,
      report,
    });

    console.log(JSON.stringify({
      ...summary,
      pagesFetched: collection.pagesFetched,
      output: options.output,
      reportOutput: options.reportOutput,
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
