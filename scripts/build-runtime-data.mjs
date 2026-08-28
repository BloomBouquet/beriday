import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadOfficialDataAsset } from '../dist-tests/src/data/canonical/officialDataAsset.js';
import {
  buildOfficialRuntimeAssets,
  serializeOfficialRuntimeManifest,
  serializeOfficialRuntimeShard,
} from '../dist-tests/src/data/canonical/runtimeDataAssets.js';

const USAGE = 'Usage: node scripts/build-runtime-data.mjs --input <json> --output-dir <directory>';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--input') options.input = value;
    if (flag === '--output-dir') options.outputDir = value;

    if (flag === '--input' || flag === '--output-dir') {
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));

if (!options.input || !options.outputDir) {
  console.error(USAGE);
  process.exitCode = 1;
} else {
  const canonicalText = await readFile(options.input, 'utf8');
  const bundle = loadOfficialDataAsset(canonicalText);
  const runtime = buildOfficialRuntimeAssets(bundle);

  await rm(options.outputDir, { recursive: true, force: true });
  await mkdir(options.outputDir, { recursive: true });
  await writeFile(
    path.join(options.outputDir, 'manifest.json'),
    serializeOfficialRuntimeManifest(runtime.manifest),
    'utf8',
  );

  for (const shard of runtime.shards) {
    const output = path.join(options.outputDir, shard.path);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, serializeOfficialRuntimeShard(shard.asset), 'utf8');
  }

  console.log(JSON.stringify({
    importedAt: runtime.manifest.importedAt,
    regions: runtime.manifest.summary.coveredRegions,
    rules: runtime.manifest.summary.rules,
    shards: runtime.shards.length,
    outputDir: options.outputDir,
  }));
}
