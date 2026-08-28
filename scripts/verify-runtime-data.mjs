import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadOfficialDataAsset } from '../dist-tests/src/data/canonical/officialDataAsset.js';
import {
  loadOfficialRuntimeManifest,
  loadOfficialRuntimeShard,
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

function resolveShardPath(runtimeRoot, shardId, relativePath) {
  const expectedPath = `shards/${shardId}.json`;
  if (relativePath !== expectedPath) {
    throw new Error(`Invalid runtime shard path for ${shardId}`);
  }

  const root = path.resolve(runtimeRoot);
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const shardRoot = path.resolve(root, 'shards');
  if (!resolved.startsWith(`${shardRoot}${path.sep}`)) {
    throw new Error(`Runtime shard path escapes shard directory: ${shardId}`);
  }
  return resolved;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const [assetText, reportText, manifestText] = await Promise.all([
    readFile(options.asset, 'utf8'),
    readFile(options.report, 'utf8'),
    readFile(path.join(options.runtimeRoot, 'manifest.json'), 'utf8'),
  ]);
  const bundle = loadOfficialDataAsset(assetText);
  const report = JSON.parse(reportText);
  if (typeof report.sourceUpdatedAt !== 'string' || !report.sourceUpdatedAt.trim()) {
    throw new Error('Official validation report sourceUpdatedAt is required');
  }
  if (report.importedAt !== bundle.importedAt) {
    throw new Error('Official validation report importedAt does not match canonical data');
  }

  const manifest = loadOfficialRuntimeManifest(manifestText);
  const shards = {};
  for (const [shardId, metadata] of Object.entries(manifest.shards)) {
    const shardPath = resolveShardPath(options.runtimeRoot, shardId, metadata.path);
    const shard = loadOfficialRuntimeShard(await readFile(shardPath, 'utf8'));
    shards[shardId] = shard;
  }

  verifyOfficialRuntimeData(bundle, report.sourceUpdatedAt, { manifest, shards });
  console.log(JSON.stringify({
    importedAt: manifest.importedAt,
    sourceUpdatedAt: manifest.sourceUpdatedAt,
    regions: manifest.regionCount,
    rules: manifest.ruleCount,
    shards: Object.keys(shards).length,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
