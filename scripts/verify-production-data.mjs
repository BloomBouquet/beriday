import { readFile } from 'node:fs/promises';
import { loadOfficialDataAsset } from '../dist-tests/src/data/canonical/officialDataAsset.js';
import { verifyProductionDataPair } from '../dist-tests/src/data/canonical/productionDataGate.js';

const USAGE = 'Usage: node scripts/verify-production-data.mjs --asset <json> --report <json>';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--asset') options.asset = value;
    if (flag === '--report') options.report = value;

    if (flag === '--asset' || flag === '--report') {
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));

if (!options.asset || !options.report) {
  console.error(USAGE);
  process.exitCode = 1;
} else {
  try {
    const [assetText, reportText] = await Promise.all([
      readFile(options.asset, 'utf8'),
      readFile(options.report, 'utf8'),
    ]);
    const bundle = loadOfficialDataAsset(assetText);
    const report = JSON.parse(reportText);
    const result = verifyProductionDataPair(bundle, report);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
