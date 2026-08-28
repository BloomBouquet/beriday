import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadOfficialDataAsset } from '../dist-tests/src/data/canonical/officialDataAsset.js';
import {
  buildOfficialRuntimeData,
  serializeOfficialRuntimeManifest,
  serializeOfficialRuntimeShard,
  verifyOfficialRuntimeData,
} from '../dist-tests/src/data/runtime/officialRuntimeData.js';

const DEFAULTS = {
  asset: './public/data/official-data.json',
  report: './data/reports/official-data-validation.json',
  runtimeRoot: './public/data/runtime',
};

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--asset') options.asset = value;
    else if (flag === '--report') options.report = value;
    else if (flag === '--runtime-root') options.runtimeRoot = value;
    else throw new Error(`Unknown runtime data argument: ${flag}`);

    if (!value) throw new Error(`Missing value for runtime data argument: ${flag}`);
    index += 1;
  }

  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const [assetText, reportText] = await Promise.all([
    readFile(options.asset, 'utf8'),
    readFile(options.report, 'utf8'),
  ]);
  const bundle = loadOfficialDataAsset(assetText);
  const report = JSON.parse(reportText);
  if (typeof report.sourceUpdatedAt !== 'string' || !report.sourceUpdatedAt.trim()) {
    throw new Error('Official validation report sourceUpdatedAt is required');
  }
  if (report.importedAt !== bundle.importedAt) {
    throw new Error('Official validation report importedAt does not match canonical data');
  }

  const runtime = buildOfficialRuntimeData(bundle, report.sourceUpdatedAt);
  verifyOfficialRuntimeData(bundle, report.sourceUpdatedAt, runtime);

  await rm(options.runtimeRoot, { recursive: true, force: true });
  const shardRoot = path.join(options.runtimeRoot, 'shards');
  await mkdir(shardRoot, { recursive: true });
  await writeFile(
    path.join(options.runtimeRoot, 'manifest.json'),
    serializeOfficialRuntimeManifest(runtime.manifest),
    'utf8',
  );

  for (const [shardId, shard] of Object.entries(runtime.shards)) {
    await writeFile(
      path.join(shardRoot, `${shardId}.json`),
      serializeOfficialRuntimeShard(shard),
      'utf8',
    );
  }

  console.log(JSON.stringify({
    runtimeRoot: options.runtimeRoot,
    importedAt: runtime.manifest.importedAt,
    sourceUpdatedAt: runtime.manifest.sourceUpdatedAt,
    regions: runtime.manifest.regionCount,
    rules: runtime.manifest.ruleCount,
    shards: Object.keys(runtime.shards).length,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
