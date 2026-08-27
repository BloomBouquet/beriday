import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildOfficialDataBundle } from '../dist-tests/src/data/canonical/officialDataBundle.js';
import { serializeOfficialDataAsset } from '../dist-tests/src/data/canonical/officialDataAsset.js';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--input') options.input = value;
    if (flag === '--output') options.output = value;
    if (flag === '--imported-at') options.importedAt = value;

    if (flag === '--input' || flag === '--output' || flag === '--imported-at') {
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const csv = await readFile(options.input, 'utf8');
const bundle = buildOfficialDataBundle(csv, options.importedAt);
const asset = serializeOfficialDataAsset(bundle);

await mkdir(path.dirname(options.output), { recursive: true });
await writeFile(options.output, asset, 'utf8');
