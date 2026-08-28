import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeOfficialDataOutputs } from '../../scripts/official-data-outputs.mjs';

test('writes the official asset and validation report together to explicit paths', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beriday-official-output-'));
  const assetOutput = path.join(dir, 'public', 'data', 'official-data.json');
  const reportOutput = path.join(dir, 'artifacts', 'official-data-validation.json');

  try {
    await writeOfficialDataOutputs({
      assetOutput,
      reportOutput,
      asset: '{"schemaVersion":1}\n',
      report: '{"criticalErrors":[]}\n',
    });

    assert.equal(await readFile(assetOutput, 'utf8'), '{"schemaVersion":1}\n');
    assert.equal(await readFile(reportOutput, 'utf8'), '{"criticalErrors":[]}\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('rejects using the same path for the deployable asset and review report', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beriday-official-output-'));
  const output = path.join(dir, 'official-data.json');

  try {
    await assert.rejects(
      writeOfficialDataOutputs({
        assetOutput: output,
        reportOutput: output,
        asset: '{}\n',
        report: '{}\n',
      }),
      /must use different paths/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
