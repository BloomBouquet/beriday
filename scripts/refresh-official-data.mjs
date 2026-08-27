import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildOfficialDataBundleFromRows } from '../dist-tests/src/data/canonical/officialDataBundle.js';
import { serializeOfficialDataAsset } from '../dist-tests/src/data/canonical/officialDataAsset.js';
import { fetchOfficialHouseholdWasteApiRows } from '../dist-tests/src/data/import/householdWasteApi.js';

const USAGE = 'Usage: node scripts/refresh-official-data.mjs --output <json> --imported-at <timestamp>';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--output') options.output = value;
    if (flag === '--imported-at') options.importedAt = value;

    if (flag === '--output' || flag === '--imported-at') {
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const serviceKey = process.env.DATA_GO_KR_API_KEY?.trim();

if (!options.output || !options.importedAt) {
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
    const asset = serializeOfficialDataAsset(bundle);

    await mkdir(path.dirname(options.output), { recursive: true });
    const temporaryOutput = `${options.output}.tmp-${process.pid}`;

    try {
      await writeFile(temporaryOutput, asset, { encoding: 'utf8', flag: 'wx' });
      await rename(temporaryOutput, options.output);
    } finally {
      await rm(temporaryOutput, { force: true });
    }

    console.log(JSON.stringify({
      sourceRows: collection.sourceReport.totalRows,
      acceptedRows: collection.sourceReport.acceptedRows,
      rejectedRows: collection.sourceReport.rejectedRows,
      pagesFetched: collection.pagesFetched,
      regions: bundle.regions.length,
      rules: bundle.rules.length,
      output: options.output,
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
